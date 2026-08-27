// ── Shared types: file generation engine (ported into GenuineOS) ──

export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export type FileFormat = 'invoice' | 'quotation' | 'estimate' | 'xlsx' | 'pptx';

export interface LineItem {
  description: string;
  qty: number;
  rate: number;
}

export interface DocPayload {
  docNumber?: string;
  date?: string;
  dueDays?: number;
  business: { name: string; address?: string; phone?: string; email?: string };
  client: { name: string; address?: string; phone?: string; email?: string };
  items: LineItem[];
  taxRate?: number;
  discount?: number;
  notes?: string;
}

export interface XlsxPayload {
  fileName?: string;
  sheets: { name: string; headers: string[]; rows: (string | number)[][] }[];
}

export interface PptxPayload {
  title: string;
  subtitle?: string;
  slides: { title: string; bullets: string[] }[];
}

export interface GeneratedFile {
  filename: string;
  mime: string;
  base64: string;
  summary: string;
}

/** Instruction block injected into the AI system prompt so the model can request files. */
export const FILEGEN_SCHEMA_PROMPT = `
## FILE GENERATION TOOL (filegen)
When the user asks you to CREATE A FILE - an invoice, quotation, estimate, bill, Excel sheet,
spreadsheet, calculation, data table, ledger, PowerPoint or presentation - you MUST respond with
a fenced code block tagged "filegen" containing STRICT JSON (no comments, no trailing commas),
following one of these schemas EXACTLY:

### invoice / quotation / estimate
\`\`\`filegen
{
  "format": "invoice",
  "payload": {
    "docNumber": "INV-001",
    "date": "2026-01-15",
    "dueDays": 15,
    "business": { "name": "My Company", "address": "...", "phone": "...", "email": "..." },
    "client": { "name": "Client Name", "address": "...", "phone": "...", "email": "..." },
    "items": [ { "description": "Item or service", "qty": 2, "rate": 45000 } ],
    "taxRate": 18,
    "discount": 0,
    "notes": "Payment terms: 50% advance."
  }
}
\`\`\`
"format" must be exactly "invoice", "quotation" or "estimate".

### xlsx - spreadsheets, calculations, data tables, ledgers, reports
\`\`\`filegen
{
  "format": "xlsx",
  "payload": {
    "fileName": "sales-report",
    "sheets": [
      { "name": "Summary", "headers": ["Item", "Qty", "Rate", "Amount"],
        "rows": [ ["Laptop", 5, 45000, "=B2*C2"], ["Total", "", "", "=SUM(D2:D3)"] ] }
    ]
  }
}
\`\`\`
RULES for xlsx: use Excel formulas (like =SUM(B2:B5), =B2*0.18) whenever a value is derived
from other cells. Numbers must be JSON numbers, not strings. Keep cell text short.

### pptx - presentations and decks
\`\`\`filegen
{
  "format": "pptx",
  "payload": {
    "title": "Quarterly Business Review",
    "subtitle": "Q1 2026",
    "slides": [
      { "title": "Agenda", "bullets": ["Revenue growth", "New markets", "Roadmap"] },
      { "title": "Revenue", "bullets": ["₹1.2 Cr total", "18% YoY growth", "Top: North zone"] }
    ]
  }
}
\`\`\`

RULES:
1. If critical details are missing, make sensible professional assumptions and mention them briefly
   in one line before the block - never refuse, always produce the filegen block.
2. Compute qty x rate values yourself when summarising, but keep raw qty/rate in the JSON.
3. After the filegen block, add a 1-2 line note about what the file contains.
4. Use ISO dates (YYYY-MM-DD). Currency amounts as plain numbers.
5. Only emit a filegen block when a file is actually requested - never for normal questions.`;
