import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// ── In-memory rate limiter (per deployment; resets on cold start) ──
// Enforces per-second (token bucket) and per-minute (sliding window) limits
// configured by the user in Settings → LLM & AI.
const rateBuckets = new Map<string, { tokens: number; lastRefill: number; minuteWindow: number[] }>();

function checkRateLimit(key: string, rps: number, rpm: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b) {
    b = { tokens: rps, lastRefill: now, minuteWindow: [] };
    rateBuckets.set(key, b);
  }
  // Refill tokens based on elapsed time
  const elapsed = (now - b.lastRefill) / 1000;
  b.tokens = Math.min(rps, b.tokens + elapsed * rps);
  b.lastRefill = now;
  // Sliding window for RPM
  b.minuteWindow = b.minuteWindow.filter((t) => now - t < 60000);
  if (b.minuteWindow.length >= rpm) {
    const oldest = b.minuteWindow[0];
    return { allowed: false, retryAfterMs: 60000 - (now - oldest) };
  }
  if (b.tokens < 1) {
    return { allowed: false, retryAfterMs: Math.max(500, Math.ceil(((1 - b.tokens) / rps) * 1000)) };
  }
  b.tokens -= 1;
  b.minuteWindow.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

const SYSTEM_PROMPT = `You are GenuineOS AI Assistant — an intelligent business management copilot. You help users manage their business data and can answer any general questions, perform research, or write content.

## Core Rules
1. You can chat freely, answer questions, and perform research using your internal knowledge. Do not apologize for not having a specific tool if you can answer it yourself.
2. If the user wants to RECORD, UPDATE, or DELETE business data, you MUST use one of the available tools.
3. If the user wants to FETCH, VIEW, or GET business data, use the FETCH_DATA tool.
4. To use a tool, output a JSON block anywhere in your response like this:
\`\`\`json
{"tool":"TOOL_NAME","params":{...}}
\`\`\`
5. "28 lakh" = 2800000, "5 crore" = 50000000. Default mode = "cash".
6. For journal entries, use ADD_NOTE. For a new party/person, use ADD_CLIENT.

## Available Tools
- ADD_PAYMENT: party (str,req), amount (num,req), date?, mode?, category?, notes?, siteId?
- ADD_EXPENSE: title (str,req), amount (num,req), date?, category?, paidTo?, mode?, notes?, siteId?
- ADD_RECEIVABLE: party (str,req), amount (num,req), dueDate?, description?, priority?, notes?
- UPDATE_RECEIVABLE: id (str,req), receivedAmount?, status?, notes?
- ADD_TASK: title (str,req), description?, priority?, dueDate?, tags?, siteId?
- UPDATE_TASK: id (str,req), status?, priority?
- ADD_SITE: name (str,req), location?, contractValue?, contractor?, startDate?, notes?
- ADD_LABOUR: name (str,req), role?, phone?, dailyWage?, siteId?, notes?
- ADD_CLIENT: name (str,req), phone?, email?, address?, gstNumber?, type?
- ADD_NOTE: title (str,req), content (str,req), category?
- DELETE_RECORD: type (str,req), id (str,req)
- FETCH_DATA: model (str,req) [options: payment, expense, receivable, task, site, labour, client, note], query (str,opt)
`;

export async function POST(request: NextRequest) {
  try {
    const {
      message,
      history = [],
      memoryContext = '',
      apiKey,
      baseUrl = 'https://integrate.api.nvidia.com/v1',
      model = 'z-ai/glm-5.1',
      temperature = 0.7,
      maxTokens = 1024,
      thinkingEnabled = true,
      followUp = null,
      rps = 2,
      rpm = 60,
    } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // ── Enforce user-configured rate limits ──
    const safeRps = Math.min(Math.max(Number(rps) || 2, 0.5), 20);
    const safeRpm = Math.min(Math.max(Number(rpm) || 60, 1), 600);
    const clientKey = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
    const rl = checkRateLimit(clientKey, safeRps, safeRpm);
    if (!rl.allowed) {
      const waitSec = Math.ceil(rl.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Rate limit reached (${safeRps}/sec, ${safeRpm}/min). Try again in ${waitSec}s.` },
        { status: 429, headers: { 'Retry-After': String(waitSec) } }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured. Go to Settings > LLM & AI and add your NVIDIA API key.' },
        { status: 400 }
      );
    }

    // 1. Safety & Validation constraints
    if (message.length > 4000) {
      return NextResponse.json({ error: 'Message exceeds the maximum limit of 4000 characters.' }, { status: 400 });
    }

    const safeMaxTokens = Math.min(Math.max(1, maxTokens), 8192); // Ensure within NIM limits
    const safeTemperature = Math.min(Math.max(0, temperature), 2.0); // NIM allows up to 2.0, normally 1.0

    // Build system prompt with context
    let systemContent = SYSTEM_PROMPT;
    if (memoryContext) {
      // Limit memory context to prevent huge prompts
      const trimmedMemory = memoryContext.substring(0, 8000);
      systemContent += `\n\n## User's Business Context (from memory)\n${trimmedMemory}`;
    }

    // Strictly limit history to last 10 messages to prevent token bloat
    const recentHistory = history.slice(-10);

    // Merge consecutive messages of the same role (Llama models often crash on consecutive 'user' roles)
    const normalizedHistory: { role: string; content: string }[] = [];
    for (const m of recentHistory) {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      const content = m.content ? m.content.substring(0, 4000) : '...';
      
      if (normalizedHistory.length > 0 && normalizedHistory[normalizedHistory.length - 1].role === role) {
        normalizedHistory[normalizedHistory.length - 1].content += `\n\n${content}`;
      } else {
        normalizedHistory.push({ role, content });
      }
    }

    const messages = [
      { role: 'system', content: systemContent },
      ...normalizedHistory,
    ];

    // Ensure the final message is the current user message, merging if the last history was also user
    // (skipped for follow-up confirmations — the client already includes the full thread)
    if (!followUp) {
      if (messages[messages.length - 1].role === 'user') {
        messages[messages.length - 1].content += `\n\n${message}`;
      } else {
        messages.push({ role: 'user', content: message });
      }
    }

    const openai = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout: 45000, // 45 seconds timeout to prevent hung serverless functions
      maxRetries: 2, // Native retry on rate limits or failures
    });

    // ── Agentic follow-up: a tool already executed client-side — ask the model to confirm ──
    if (followUp && followUp.summary) {
      const confirmMessages = [
        ...messages,
        {
          role: 'system',
          content: `A tool just executed on the user's behalf.\n\nTool: ${followUp.tool || 'unknown'}\nResult: ${String(followUp.summary).substring(0, 3000)}\n\nReply to the user with a short, natural confirmation of what was done (max 2-3 lines), in the same language the user wrote in. Do not mention JSON, tool names, or technical details unless useful.`,
        },
      ];
      const confirmCompletion = await openai.chat.completions.create({
        model: model,
        messages: confirmMessages as any,
        temperature: safeTemperature,
        max_tokens: Math.min(safeMaxTokens, 512),
      });
      const confirmText = confirmCompletion.choices[0]?.message?.content?.trim() || 'Done.';
      return NextResponse.json({ response: confirmText, model: model });
    }

    const completion = await openai.chat.completions.create({
      model: model,
      messages: messages as any,
      temperature: safeTemperature,
      max_tokens: safeMaxTokens,
    });

    // Extract reasoning content for thinking models (DeepSeek/GLM-style), if enabled
    const rawMessage = completion.choices[0]?.message as any;
    let reasoning = '';
    if (thinkingEnabled) {
      reasoning = (rawMessage?.reasoning_content || rawMessage?.reasoning || '').trim();
    }
    let response = rawMessage?.content || '';
    if (!response.trim()) {
      response = 'Sorry, I could not generate a response. Please try again.';
    }

    let toolCall: any = null;
    let responseText = response.trim();

    // Try tool detection — look for JSON block
    try {
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || responseText.match(/(\{[\s\S]*"tool"\s*:\s*"[^"]+"[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.tool && parsed.params) {
          toolCall = { tool: parsed.tool, params: parsed.params };
          responseText = responseText.replace(jsonMatch[0], '').trim();
          if (!responseText) {
            responseText = `Executing ${parsed.tool}...`;
          }
        }
      }
    } catch {
      /* not a tool call or invalid json, just return the text */
    }

    return NextResponse.json({
      response: responseText,
      thinkingProcess: reasoning || undefined,
      toolUsed: toolCall ? true : false,
      toolCall,
      model: model,
    });
  } catch (error: any) {
    console.error('[Chat] Unexpected error:', error);

    // Handle specific OpenAI / NIM API errors gracefully
    if (error?.status === 429) {
      return NextResponse.json(
        { error: 'You have hit the NVIDIA API rate limit. Please wait a moment and try again.' },
        { status: 429 }
      );
    }
    if (error?.status >= 500) {
      return NextResponse.json(
        { error: 'The NVIDIA NIM service is currently experiencing issues. Please try again later.' },
        { status: error.status }
      );
    }
    if (error?.name === 'APITimeoutError' || error?.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { error: 'The request to NVIDIA NIM timed out. Please try again.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
