import { NextRequest, NextResponse } from 'next/server';

// ── Date normalization helpers ─────────────────────────────────────────

function normalizeDate(d: Date | string | undefined): Date | undefined {
  if (!d) return undefined;
  const date = new Date(d);
  if (isNaN(date.getTime())) return undefined;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// ── POST - Sheet operations: connect, test, fetch, sync ───
// Returns raw data to client for IndexedDB import

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sheetId, apiKey } = body;

    const sid = sheetId;
    const key = apiKey;

    if (!sid || !key) {
      return NextResponse.json({ error: 'Sheet ID and API Key are required' }, { status: 400 });
    }

    if (action === 'connect' || action === 'test') {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sid}?key=${key}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        const msg = err.error?.message || 'Connection failed';
        return NextResponse.json({ success: false, error: msg });
      }
      const sheetData = await res.json();
      const sheetNames = (sheetData.sheets || []).map((s: any) => s.properties.title);
      return NextResponse.json({ success: true, message: `Connected! Found ${sheetNames.length} sheets`, sheets: sheetNames });
    }

    if (action === 'fetch' || action === 'sync') {
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sid}?key=${key}`;
      const metaRes = await fetch(metaUrl);
      if (!metaRes.ok) return NextResponse.json({ error: 'Failed to fetch sheet metadata' }, { status: 400 });
      const metaData = await metaRes.json();
      const sheetNames = (metaData.sheets || []).map((s: any) => s.properties.title);

      // Collect all parsed data
      const sheetData: Record<string, any[]> = {};
      let hasMainSheet = false;

      for (const sheetName of sheetNames) {
        if (sheetName.toLowerCase() === 'main') {
          hasMainSheet = true;
          break;
        }
      }

      // Fetch all sheets
      for (const sheetName of sheetNames) {
        const range = encodeURIComponent(`${sheetName}!A1:ZZ`);
        const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${range}?key=${key}`;
        const dataRes = await fetch(dataUrl);
        if (!dataRes.ok) continue;
        const data = await dataRes.json();
        const rows = data.values || [];
        if (rows.length < 2) { sheetData[sheetName] = []; continue; }

        const headers = rows[0].map((h: string) => h.toString().toLowerCase().trim());
        const dataRows = rows.slice(1).filter((r: any[]) => r.some((cell: any) => cell !== ''));
        sheetData[sheetName] = dataRows;
      }

      // Parse into structured records for client-side import
      const parsedData: any = {
        sites: [] as any[],
        labour: [] as any[],
        clients: [] as any[],
        payments: [] as any[],
        expenses: [] as any[],
      };

      // Parse reference sheets first
      for (const sheetName of sheetNames) {
        const dataRows = sheetData[sheetName] || [];
        if (dataRows.length === 0) continue;

        const headers = Object.keys(sheetData[sheetName]?.[0] || {}).length > 0
          ? [] : [];

        // Re-derive headers from raw data
        const rawHeaders = await getSheetHeaders(sid, sheetName, key);
        if (!rawHeaders) continue;

        if (sheetName.toLowerCase() === 'sites') {
          const nameIdx = rawHeaders.findIndex((h: string) => h.includes('name') || h.includes('site'));
          if (nameIdx === -1) continue;
          for (const row of dataRows) {
            const name = String(row[nameIdx] || '').trim();
            if (name) parsedData.sites.push({ name, status: 'active' });
          }
        } else if (sheetName.toLowerCase() === 'labour') {
          const nameIdx = rawHeaders.findIndex((h: string) => h.includes('name') || h.includes('labour'));
          if (nameIdx === -1) continue;
          for (const row of dataRows) {
            const name = String(row[nameIdx] || '').trim();
            if (name) parsedData.labour.push({ name, role: 'worker', status: 'active' });
          }
        } else if (sheetName.toLowerCase() === 'parties' || sheetName.toLowerCase() === 'clients') {
          const nameIdx = rawHeaders.findIndex((h: string) => h.includes('name') || h.includes('party'));
          if (nameIdx === -1) continue;
          for (const row of dataRows) {
            const name = String(row[nameIdx] || '').trim();
            if (name) parsedData.clients.push({ name, type: 'customer', status: 'active' });
          }
        }
      }

      // Parse Main sheet (transactions)
      if (hasMainSheet && (action === 'fetch' || action === 'sync')) {
        const mainRows = sheetData['Main'] || sheetData['main'] || [];
        if (mainRows.length > 0) {
          const headers = await getSheetHeaders(sid, 'Main', key);
          if (headers) {
            const colIdx = mapMainColumns(headers);

            for (const row of mainRows) {
              const type = colIdx.type !== undefined ? String(row[colIdx.type] || '').trim() : '';
              const amountVal = colIdx.amount !== undefined ? row[colIdx.amount] : 0;
              const amount = parseFloat(String(amountVal || '0').replace(/[,₹]/g, '')) || 0;
              if (!amount || !type) continue;

              const dateVal = colIdx.date !== undefined ? row[colIdx.date] : null;
              const date = dateVal ? normalizeDate(dateVal) : new Date();
              const category = colIdx.category !== undefined ? String(row[colIdx.category] || '').trim() : '';
              const description = colIdx.description !== undefined ? String(row[colIdx.description] || '').trim() : '';
              const siteName = colIdx.site !== undefined ? String(row[colIdx.site] || '').trim() : '';
              const party = colIdx.party !== undefined ? String(row[colIdx.party] || '').trim() : '';
              const user = colIdx.user !== undefined ? String(row[colIdx.user] || '').trim() : '';
              const labour = colIdx.labour !== undefined ? String(row[colIdx.labour] || '').trim() : '';

              if (type === 'Payment Received') {
                parsedData.payments.push({
                  party: party || 'Unknown',
                  amount,
                  date: date ? date.toISOString() : new Date().toISOString(),
                  mode: 'cash',
                  category: category !== 'N/A' ? category : 'Payment Received',
                  siteName: siteName || null,
                  partner: user || null,
                  notes: description,
                });
              } else if (type === 'Expense') {
                parsedData.expenses.push({
                  title: description || category || 'Other',
                  amount,
                  date: date ? date.toISOString() : new Date().toISOString(),
                  category: category !== 'N/A' ? category : 'Other',
                  paidTo: labour || null,
                  mode: 'cash',
                  siteName: siteName || null,
                  partner: user || null,
                  notes: description,
                });
              }
            }
          }
        }
      }

      // Also parse auto-detected sheets if no Main sheet
      if (!hasMainSheet && action === 'sync') {
        for (const sheetName of sheetNames) {
          const name = sheetName.toLowerCase();
          if (['main', 'sites', 'labour', 'parties', 'clients', 'categories'].includes(name)) continue;

          const dataRows = sheetData[sheetName] || [];
          if (dataRows.length === 0) continue;

          const headers = await getSheetHeaders(sid, sheetName, key);
          if (!headers) continue;

          const detectedType = detectSheetType(sheetName, headers);
          if (!detectedType) continue;

          if (detectedType === 'payment') {
            const mapped = parseTransactionSheet(headers, dataRows, 'payment');
            parsedData.payments.push(...mapped);
          } else if (detectedType === 'expense') {
            const mapped = parseTransactionSheet(headers, dataRows, 'expense');
            parsedData.expenses.push(...mapped);
          }
        }
      }

      const totalRecords = parsedData.payments.length + parsedData.expenses.length +
        parsedData.sites.length + parsedData.labour.length + parsedData.clients.length;

      return NextResponse.json({
        success: true,
        message: action === 'sync'
          ? `Fetched ${totalRecords} records from ${sheetNames.length} sheets. Importing to local database...`
          : `Fetched ${sheetNames.length} sheets. Use "Sync" to import data.`,
        sheets: sheetData,
        sheetNames,
        totalRecords,
        sheetData: parsedData,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Sheets API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Sync status (returns basic info, actual status is now in IndexedDB)
export async function GET() {
  return NextResponse.json({ connected: false, message: 'Sync status is now managed client-side via IndexedDB' });
}

// ── Helper functions ──

async function getSheetHeaders(sheetId: string, sheetName: string, apiKey: string): Promise<string[] | null> {
  const range = encodeURIComponent(`${sheetName}!A1:1`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.values?.[0] || []).map((h: string) => h.toString().toLowerCase().trim());
}

function mapMainColumns(headers: string[]): Record<string, number> {
  const colIdx: Record<string, number> = {};
  headers.forEach((val, i) => {
    if (val === 'date') colIdx.date = i;
    if (val === 'type') colIdx.type = i;
    if (val === 'amount') colIdx.amount = i;
    if (val === 'category') colIdx.category = i;
    if (val === 'discription' || val === 'description') colIdx.description = i;
    if (val === 'labour') colIdx.labour = i;
    if (val === 'site') colIdx.site = i;
    if (val === 'party') colIdx.party = i;
    if (val === 'user') colIdx.user = i;
    if (val === 'chatid') colIdx.chatId = i;
  });
  return colIdx;
}

function detectSheetType(sheetName: string, headers: string[]): string | null {
  const name = sheetName.toLowerCase();
  const h = headers.join(' ');
  if (name.includes('client') || name.includes('party') || name.includes('customer')) return 'client';
  if (name.includes('site') || name.includes('project') || name.includes('work')) return 'site';
  if (name.includes('labour') || name.includes('worker') || name.includes('employee')) return 'labour';
  if (name.includes('payment') || name.includes('received') || name.includes('income')) return 'payment';
  if (name.includes('expense') || name.includes('spent') || name.includes('cost')) return 'expense';
  return null;
}

function parseTransactionSheet(headers: string[], rows: any[][], type: 'payment' | 'expense'): any[] {
  const results: any[] = [];

  const paymentHeaderMap: Record<string, string> = {
    party: 'party', name: 'party', from: 'party',
    amount: 'amount', received: 'amount', total: 'amount', rupees: 'amount',
    date: 'date', 'payment date': 'date',
    mode: 'mode', method: 'mode',
    reference: 'reference', ref: 'reference', utr: 'reference',
    notes: 'notes', remark: 'notes', description: 'notes',
    category: 'category', head: 'category',
    partner: 'partner', user: 'partner',
  };

  const expenseHeaderMap: Record<string, string> = {
    title: 'title', description: 'title', item: 'title', particular: 'title', expense: 'title',
    amount: 'amount', rupees: 'amount', total: 'amount', cost: 'amount',
    date: 'date', 'expense date': 'date',
    category: 'category', head: 'category', type: 'category',
    paidto: 'paidTo', 'paid to': 'paidTo', vendor: 'paidTo', supplier: 'paidTo',
    mode: 'mode', method: 'mode',
    billno: 'billNo', 'bill no': 'billNo',
    notes: 'notes', remark: 'notes',
    partner: 'partner', user: 'partner',
    site: 'siteName',
  };

  const headerMap = type === 'payment' ? paymentHeaderMap : expenseHeaderMap;
  const fieldMap: Record<number, string> = {};
  headers.forEach((h, i) => {
    if (headerMap[h]) fieldMap[i] = headerMap[h];
  });

  for (const row of rows) {
    const record: any = {};
    for (const [ci, fn] of Object.entries(fieldMap)) {
      const val = row[parseInt(ci)];
      if (val !== undefined && val !== '') {
        if (fn === 'amount') record[fn] = parseFloat(String(val).replace(/[,₹]/g, '')) || 0;
        else if (fn === 'date') {
          const d = normalizeDate(val);
          record[fn] = d ? d.toISOString() : new Date().toISOString();
        }
        else record[fn] = String(val).trim();
      }
    }

    if (type === 'payment' && (!record.party || !record.amount)) continue;
    if (type === 'expense' && (!record.title || !record.amount)) continue;

    record.mode = record.mode || 'cash';
    if (!record.date) record.date = new Date().toISOString();

    results.push(record);
  }

  return results;
}
