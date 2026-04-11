import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM_PROMPT = `You are GenuineOS AI Assistant — an intelligent business management copilot. You have deep understanding of the user's business data and can execute operations through tools.

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
- SEARCH_DATA: query (str,req), type?
- GET_SUMMARY: (no params)
- DELETE_RECORD: type (str,req), id (str,req)

## Rules
1. "28 lakh" = 2800000, "5 crore" = 50000000
2. Default mode = "cash"
3. For dates: "tomorrow" = next day, "next monday" = upcoming Monday
4. Be concise but friendly in confirmations
5. Always confirm what was recorded with key details`;

async function executeTool(tool: string, params: any): Promise<any> {
  try {
    switch (tool) {
      case 'ADD_PAYMENT': {
        const rec = await db.payment.create({
          data: { party: params.party, amount: parseFloat(params.amount), date: params.date ? new Date(params.date) : new Date(), mode: params.mode || 'cash', category: params.category, notes: params.notes, siteId: params.siteId, reference: params.reference, managerId: params.managerId },
        });
        return { success: true, message: `Payment ₹${params.amount} from ${params.party} recorded`, data: rec };
      }
      case 'ADD_EXPENSE': {
        const rec = await db.expense.create({
          data: { title: params.title, amount: parseFloat(params.amount), date: params.date ? new Date(params.date) : new Date(), category: params.category || 'general', paidTo: params.paidTo, mode: params.mode || 'cash', notes: params.notes, siteId: params.siteId, billNo: params.billNo, managerId: params.managerId },
        });
        return { success: true, message: `Expense ₹${params.amount} for "${params.title}" recorded`, data: rec };
      }
      case 'ADD_RECEIVABLE': {
        const rec = await db.receivable.create({
          data: { party: params.party, amount: parseFloat(params.amount), dueDate: params.dueDate ? new Date(params.dueDate) : null, description: params.description, priority: params.priority || 'medium', notes: params.notes },
        });
        return { success: true, message: `Receivable ₹${params.amount} from ${params.party} added`, data: rec };
      }
      case 'UPDATE_RECEIVABLE': {
        const upd: any = {};
        if (params.receivedAmount !== undefined) upd.receivedAmount = parseFloat(params.receivedAmount);
        if (params.status) upd.status = params.status;
        if (params.notes) upd.notes = params.notes;
        const rec = await db.receivable.update({ where: { id: params.id }, data: upd });
        return { success: true, message: `Receivable updated`, data: rec };
      }
      case 'ADD_TASK': {
        const rec = await db.task.create({
          data: { title: params.title, description: params.description, priority: params.priority || 'medium', dueDate: params.dueDate ? new Date(params.dueDate) : null, tags: params.tags, siteId: params.siteId },
        });
        return { success: true, message: `Task "${params.title}" created`, data: rec };
      }
      case 'UPDATE_TASK': {
        const upd: any = {};
        if (params.status) upd.status = params.status;
        if (params.priority) upd.priority = params.priority;
        if (params.status === 'completed') upd.completedAt = new Date();
        const rec = await db.task.update({ where: { id: params.id }, data: upd });
        return { success: true, message: `Task updated to "${params.status || 'updated'}"`, data: rec };
      }
      case 'ADD_SITE': {
        const cv = params.contractValue ? parseFloat(params.contractValue) : 0;
        const rec = await db.site.create({
          data: { name: params.name, location: params.location, contractValue: cv, pendingAmount: cv, contractor: params.contractor, startDate: params.startDate ? new Date(params.startDate) : null, notes: params.notes },
        });
        return { success: true, message: `Site "${params.name}" created`, data: rec };
      }
      case 'ADD_LABOUR': {
        const rec = await db.labour.create({
          data: { name: params.name, role: params.role || 'worker', phone: params.phone, dailyWage: params.dailyWage ? parseFloat(params.dailyWage) : 0, siteId: params.siteId, notes: params.notes },
        });
        return { success: true, message: `Labour "${params.name}" added`, data: rec };
      }
      case 'ADD_NOTE': {
        const rec = await db.note.create({ data: { title: params.title, content: params.content, category: params.category || 'general' } });
        return { success: true, message: `Note "${params.title}" saved`, data: rec };
      }
      case 'ADD_CLIENT': {
        const rec = await db.client.create({ data: { name: params.name, phone: params.phone, email: params.email, address: params.address, gstNumber: params.gstNumber, type: params.type || 'customer' } });
        return { success: true, message: `Client "${params.name}" added`, data: rec };
      }
      case 'CALCULATE': {
        try {
          const expr = params.expression.replace(/[^0-9+\-*/().%\s]/g, '').replace(/×/g, '*').replace(/÷/g, '/');
          const result = Function(`"use strict"; return (${expr})`)();
          return { success: true, message: `${params.expression} = ${result}`, data: { expression: params.expression, result } };
        } catch { return { success: false, message: 'Could not calculate' }; }
      }
      case 'SEARCH_DATA': {
        const q = params.query || '';
        const t = params.type;
        const results: any = {};
        const searches: [string, any][] = [
          ['client', { where: { OR: [{ name: { contains: q } }, { phone: { contains: q } }] }, take: 10 }],
          ['payment', { where: { party: { contains: q } }, take: 10, orderBy: { date: 'desc' } }],
          ['site', { where: { name: { contains: q } }, take: 10 }],
          ['task', { where: { OR: [{ title: { contains: q } }, { description: { contains: q } }] }, take: 10 }],
          ['expense', { where: { title: { contains: q } }, take: 10 }],
          ['receivable', { where: { party: { contains: q } }, take: 10 }],
          ['labour', { where: { OR: [{ name: { contains: q } }, { phone: { contains: q } }] }, take: 10 }],
        ];
        for (const [key, opts] of searches) {
          if (!t || t === key) results[key + 's'] = await (MODEL_MAP as any)[key].findMany(opts);
        }
        const total = Object.values(results).reduce((s: number, a: any) => s + a.length, 0);
        return { success: true, message: `Found ${total} results for "${q}"`, data: results };
      }
      case 'GET_SUMMARY': {
        const [p, e, r, s, l, t] = await Promise.all([
          db.payment.aggregate({ _sum: { amount: true }, _count: true }),
          db.expense.aggregate({ _sum: { amount: true }, _count: true }),
          db.receivable.aggregate({ _sum: { amount: true, receivedAmount: true } }),
          db.site.count(), db.labour.count(), db.task.count(),
        ]);
        const tr = p._sum.amount || 0, te = e._sum.amount || 0, trec = r._sum.amount || 0, recvd = r._sum.receivedAmount || 0;
        return { success: true, message: `📊 Total Received: ₹${tr.toLocaleString('en-IN')} | Expenses: ₹${te.toLocaleString('en-IN')} | Balance: ₹${(tr - te).toLocaleString('en-IN')} | Pending: ₹${(trec - recvd).toLocaleString('en-IN')} | Sites: ${s} | Labour: ${l} | Tasks: ${t}`, data: { totalReceived: tr, totalExpenses: te, balance: tr - te, pendingReceivables: trec - recvd } };
      }
      case 'DELETE_RECORD': {
        const MAP: Record<string, any> = { client: db.client, site: db.site, payment: db.payment, expense: db.expense, receivable: db.receivable, task: db.task, labour: db.labour, note: db.note };
        if (!MAP[params.type]) return { success: false, message: `Unknown type: ${params.type}` };
        await MAP[params.type].delete({ where: { id: params.id } });
        return { success: true, message: `${params.type} deleted` };
      }
      default: return { success: false, message: `Unknown tool: ${tool}` };
    }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message}` };
  }
}

const MODEL_MAP: Record<string, any> = {
  client: db.client, payment: db.payment, site: db.site,
  task: db.task, expense: db.expense, receivable: db.receivable,
  labour: db.labour, note: db.note,
};

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

    // Get settings
    let settings;
    try { settings = await db.appSettings.findFirst(); } catch { settings = null; }

    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages,
      temperature: settings?.temperature ?? 0.7,
      max_tokens: settings?.maxTokens ?? 4096,
    });

    const response = completion.choices[0]?.message?.content || '';
    let toolResult = null;
    let finalResponse = response;
    let thinkingProcess = '';

    // Check for thinking process in response
    if (thinkingEnabled && response.includes('<think')) {
      const thinkMatch = response.match(/<think[^>]*>([\s\S]*?)<\/think>/);
      if (thinkMatch) {
        thinkingProcess = thinkMatch[1].trim();
        finalResponse = response.replace(/<think[^>]*>[\s\S]*?<\/think>/, '').trim();
      }
    }

    // Try tool execution
    try {
      const cleaned = finalResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.tool && parsed.params) {
        toolResult = await executeTool(parsed.tool, parsed.params);

        if (toolResult.success) {
          const followUp = [...messages,
            { role: 'assistant', content: cleaned },
            { role: 'user', content: `Tool result: ${JSON.stringify(toolResult.data)}. Confirm briefly.` },
          ];
          const fu = await zai.chat.completions.create({ messages: followUp, temperature: 0.4, max_tokens: 512 });
          finalResponse = fu.choices[0]?.message?.content || toolResult.message;
        } else {
          finalResponse = toolResult.message;
        }
      }
    } catch { /* not a tool call */ }

    return NextResponse.json({
      response: finalResponse,
      thinkingProcess,
      toolUsed: toolResult ? true : false,
      toolResult,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
