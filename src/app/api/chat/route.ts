import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

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

export async function POST(request: NextRequest) {
  try {
    const { message, history = [], thinkingEnabled = false, memoryContext = '' } = await request.json();
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    // Build system prompt with context
    let systemContent = SYSTEM_PROMPT;
    if (memoryContext) {
      systemContent += `\n\n## User's Business Context (from memory)\n${memoryContext}`;
    }

    const messages = [
      { role: 'system', content: systemContent },
      ...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    });

    const response = completion.choices[0]?.message?.content || '';
    let finalResponse = response;
    let thinkingProcess = '';
    let toolCall: any = null;

    // Check for thinking process in response
    if (thinkingEnabled && response.includes('<think')) {
      const thinkMatch = response.match(/<think[^>]*>([\s\S]*?)<\/think>/);
      if (thinkMatch) {
        thinkingProcess = thinkMatch[1].trim();
        finalResponse = response.replace(/<think[^>]*>[\s\S]*?<\/think>/, '').trim();
      }
    }

    // Try tool detection — return tool call to client for execution
    try {
      const cleaned = finalResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.tool && parsed.params) {
        toolCall = { tool: parsed.tool, params: parsed.params };

        // For CALCULATE, handle server-side since no DB needed
        if (parsed.tool === 'CALCULATE') {
          try {
            const expr = parsed.params.expression.replace(/[^0-9+\-*/().%\s]/g, '').replace(/×/g, '*').replace(/÷/g, '/');
            const result = Function(`"use strict"; return (${expr})`)();
            finalResponse = `${parsed.params.expression} = **${result}**`;
            toolCall = null; // No client-side action needed
          } catch {
            finalResponse = 'Could not calculate that expression.';
            toolCall = null;
          }
        }
      }
    } catch { /* not a tool call, normal response */ }

    return NextResponse.json({
      response: finalResponse,
      thinkingProcess,
      toolUsed: toolCall ? true : false,
      toolCall,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
