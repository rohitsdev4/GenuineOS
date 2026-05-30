import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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
    } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
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

    const messages = [
      { role: 'system', content: systemContent },
      ...recentHistory.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content.substring(0, 4000), // Cap history messages at 4000 chars each
      })),
      { role: 'user', content: message },
    ];

    const openai = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout: 45000, // 45 seconds timeout to prevent hung serverless functions
      maxRetries: 2, // Native retry on rate limits or failures
    });

    const completion = await openai.chat.completions.create({
      model: model,
      messages: messages as any,
      temperature: safeTemperature,
      max_tokens: safeMaxTokens,
      top_p: 1,
    });

    let response = completion.choices[0]?.message?.content || '';
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
