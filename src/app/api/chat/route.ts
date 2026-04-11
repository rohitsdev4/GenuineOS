import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are GenuineOS AI Assistant — an intelligent business management copilot. You help users manage their business data and can execute operations through tools.

## Capabilities
- Record payments, expenses, receivables, tasks, sites, clients, labour, notes
- Search across all business data
- Calculate financial summaries and math
- Understand Indian number formats (lakh, crore)
- Respond in Hindi or English based on user's language

## Tool Execution
When the user wants to perform an action, respond with ONLY a JSON object:
{"tool":"TOOL_NAME","params":{...}}

Available tools:
- ADD_PAYMENT: party (str,req), amount (num,req), date?, mode?, category?, notes?, siteId?, reference?, managerId?
- ADD_EXPENSE: title (str,req), amount (num,req), date?, category?, paidTo?, mode?, notes?, siteId?, billNo?, managerId?
- ADD_RECEIVABLE: party (str,req), amount (num,req), dueDate?, description?, priority?, notes?
- UPDATE_RECEIVABLE: id (str,req), receivedAmount?, status?, notes?
- ADD_TASK: title (str,req), description?, priority?, dueDate?, tags?, siteId?
- UPDATE_TASK: id (str,req), status?, priority?
- ADD_SITE: name (str,req), location?, contractValue?, contractor?, startDate?, notes?
- ADD_LABOUR: name (str,req), role?, phone?, dailyWage?, siteId?, notes?
- ADD_CLIENT: name (str,req), phone?, email?, address?, gstNumber?, type?
- ADD_NOTE: title (str,req), content (str,req), category?
- CALCULATE: expression (str,req)
- DELETE_RECORD: type (str,req), id (str,req)

## Rules
1. "28 lakh" = 2800000, "5 crore" = 50000000
2. Default mode = "cash"
3. For dates: "tomorrow" = next day, "next monday" = upcoming Monday
4. Be concise but friendly in confirmations
5. Always confirm what was recorded with key details`;

// Gemini free-tier limits and safety
const GEMINI_FREE_MODELS: Record<string, { maxInputTokens: number; maxOutputTokens: number; supportsThinking: boolean }> = {
  'gemini-2.0-flash':       { maxInputTokens: 1_048_576, maxOutputTokens: 8192, supportsThinking: false },
  'gemini-2.0-flash-lite':  { maxInputTokens: 1_048_576, maxOutputTokens: 8192, supportsThinking: false },
  'gemini-2.5-flash-preview-05-20': { maxInputTokens: 1_048_576, maxOutputTokens: 65536, supportsThinking: true },
  'gemini-2.5-flash':       { maxInputTokens: 1_048_576, maxOutputTokens: 65536, supportsThinking: true },
};

function getModelConfig(modelName: string) {
  const config = GEMINI_FREE_MODELS[modelName];
  if (config) return { model: modelName, ...config };
  // Fallback to gemini-2.5-flash
  return { model: 'gemini-2.5-flash', maxInputTokens: 1_048_576, maxOutputTokens: 65536, supportsThinking: true };
}

export async function POST(request: NextRequest) {
  try {
    const {
      message,
      history = [],
      thinkingEnabled = false,
      memoryContext = '',
      apiKey: clientApiKey,
      model: clientModel,
      temperature: clientTemp,
      maxTokens: clientMaxTokens,
    } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = clientApiKey;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured. Go to Settings > LLM & AI and add your Gemini API key. Get a free key at https://aistudio.google.com/apikey' },
        { status: 400 }
      );
    }

    const modelConfig = getModelConfig(clientModel || '');
    const temperature = typeof clientTemp === 'number' ? clientTemp : 0.7;
    // Clamp max output tokens within model limits
    const maxOutputTokens = Math.min(
      Math.max(256, typeof clientMaxTokens === 'number' ? clientMaxTokens : 8192),
      modelConfig.maxOutputTokens
    );

    // Build system prompt with context
    let systemContent = SYSTEM_PROMPT;
    if (memoryContext) {
      systemContent += `\n\n## User's Business Context (from memory)\n${memoryContext}`;
    }

    // Build Gemini-format contents (history + new message)
    // Use last 20 messages for context window, but truncate to fit token budget
    const recentHistory = history.slice(-20);

    const contents = [
      ...recentHistory.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    // Determine model — use thinking variant if enabled and supported
    const useThinking = thinkingEnabled && modelConfig.supportsThinking;
    const finalModel = useThinking && modelConfig.model === 'gemini-2.5-flash'
      ? 'gemini-2.5-flash-preview-05-20'
      : modelConfig.model;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${finalModel}:generateContent?key=${apiKey}`;

    const body: any = {
      system_instruction: { parts: [{ text: systemContent }] },
      contents,
      generationConfig: {
        temperature: Math.max(0, Math.min(1, temperature)),
        maxOutputTokens,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    console.log(`[Chat] Using model: ${finalModel}, thinking: ${useThinking}, temp: ${temperature}, maxTokens: ${maxOutputTokens}`);

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `Gemini API error (${geminiRes.status})`;

      // Provide helpful error messages for common issues
      if (geminiRes.status === 400 && errMsg.includes('API key')) {
        return NextResponse.json({ error: 'Invalid API key. Please check your Gemini API key in Settings.' }, { status: 400 });
      }
      if (geminiRes.status === 429) {
        return NextResponse.json({ error: 'Rate limit reached. Free tier allows ~15 requests/minute. Please wait a moment and try again.' }, { status: 429 });
      }
      if (geminiRes.status === 403) {
        return NextResponse.json({ error: 'API key does not have access to this model. Try gemini-2.0-flash or check your key permissions.' }, { status: 403 });
      }

      console.error('[Chat] Gemini API error:', errMsg);
      return NextResponse.json({ error: errMsg }, { status: geminiRes.status });
    }

    const geminiData = await geminiRes.json();

    // Extract response text — handle thinking model parts
    let response = '';
    let thinkingProcess = '';

    const parts = geminiData.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.thought === true) {
        thinkingProcess += (part.text || '') + '\n';
      } else {
        response += (part.text || '');
      }
    }

    if (!response.trim()) {
      response = 'Sorry, I could not generate a response. Please try again.';
    }

    // Trim and clean
    response = response.trim();
    thinkingProcess = thinkingProcess.trim();

    let toolCall: any = null;

    // Try tool detection — return tool call to client for execution
    try {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.tool && parsed.params) {
        toolCall = { tool: parsed.tool, params: parsed.params };

        // For CALCULATE, handle server-side since no DB needed
        if (parsed.tool === 'CALCULATE') {
          try {
            const expr = parsed.params.expression.replace(/[^0-9+\-*/().%\s]/g, '').replace(/×/g, '*').replace(/÷/g, '/');
            const result = Function(`"use strict"; return (${expr})`)();
            response = `${parsed.params.expression} = **${result}**`;
            toolCall = null;
          } catch {
            response = 'Could not calculate that expression.';
            toolCall = null;
          }
        }
      }
    } catch {
      /* not a tool call, normal response */
    }

    return NextResponse.json({
      response,
      thinkingProcess: thinkingProcess || undefined,
      toolUsed: toolCall ? true : false,
      toolCall,
      model: finalModel,
    });
  } catch (error: any) {
    console.error('[Chat] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
