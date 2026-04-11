import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST - Sheet operations: connect, test, fetch, sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sheetId, apiKey } = body;

    let settings = await db.appSettings.findFirst();
    if (!settings) settings = await db.appSettings.create({ data: {} });

    const sid = sheetId || settings.googleSheetId;
    const key = apiKey || settings.googleApiKey;

    if (!sid || !key) {
      return NextResponse.json({ error: 'Sheet ID and API Key are required' }, { status: 400 });
    }

    // Save credentials
    await db.appSettings.update({
      where: { id: settings.id },
      data: { googleSheetId: sid, googleApiKey: key },
    });

    if (action === 'connect' || action === 'test') {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sid}?key=${key}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        const msg = err.error?.message || 'Connection failed';
        await db.appSettings.update({
          where: { id: settings.id },
          data: { googleSheetConnected: false, lastSyncStatus: 'error', lastSyncMessage: msg },
        });
        return NextResponse.json({ success: false, error: msg });
      }
      const sheetData = await res.json();
      const sheetNames = (sheetData.sheets || []).map((s: any) => s.properties.title);
      await db.appSettings.update({
        where: { id: settings.id },
        data: {
          googleSheetConnected: true,
          lastSyncStatus: 'connected',
          lastSyncMessage: `Connected to "${sheetData.properties?.title || 'Sheet'}" with ${sheetNames.length} sheets`,
        },
      });
      return NextResponse.json({ success: true, message: `Connected! Found ${sheetNames.length} sheets`, sheets: sheetNames });
    }

    if (action === 'fetch' || action === 'sync') {
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sid}?key=${key}`;
      const metaRes = await fetch(metaUrl);
      if (!metaRes.ok) return NextResponse.json({ error: 'Failed to fetch sheet metadata' }, { status: 400 });
      const metaData = await metaRes.json();
      const sheetNames = (metaData.sheets || []).map((s: any) => s.properties.title);

      const allData: Record<string, any[]> = {};
      let totalImported = 0;

      for (const sheetName of sheetNames) {
        const range = encodeURIComponent(`${sheetName}!A1:ZZ`);
        const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${range}?key=${key}`;
        const dataRes = await fetch(dataUrl);
        if (!dataRes.ok) continue;
        const data = await dataRes.json();
        const rows = data.values || [];
        if (rows.length < 2) { allData[sheetName] = []; continue; }

        const headers = rows[0].map((h: string) => h.toString().toLowerCase().trim());
        const dataRows = rows.slice(1).filter((r: any[]) => r.some((cell: any) => cell !== ''));
        allData[sheetName] = [{ headers, count: dataRows.length }];

        // Handle Main sheet specifically (our business transaction sheet)
        if (sheetName.toLowerCase() === 'main' && action === 'sync') {
          const imported = await importMainSheet(headers, dataRows);
          totalImported += imported;
        } else {
          // Handle reference sheets (Sites, Labour, Parties, Categories)
          if (sheetName.toLowerCase() === 'sites' || sheetName.toLowerCase() === 'labour' || sheetName.toLowerCase() === 'parties' || sheetName.toLowerCase() === 'categories') {
            const imported = await importReferenceSheet(sheetName, headers, dataRows);
            totalImported += imported;
          } else {
            const detectedType = detectSheetType(sheetName, headers);
            if (detectedType && action === 'sync') {
              const imported = await importSheetData(detectedType, headers, dataRows);
              totalImported += imported;
            }
          }
        }
      }

      const now = new Date();
      await db.appSettings.update({
        where: { id: settings.id },
        data: {
          lastSyncAt: now,
          lastSyncStatus: 'success',
          lastSyncMessage: action === 'sync'
            ? `Synced ${sheetNames.length} sheets, imported ${totalImported} records`
            : `Fetched ${sheetNames.length} sheets`,
        },
      });

      return NextResponse.json({
        success: true,
        message: action === 'sync'
          ? `Synced! ${totalImported} records imported across ${sheetNames.length} sheets`
          : `Fetched ${sheetNames.length} sheets. Use "Sync" to import data.`,
        sheets: allData,
        totalImported,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Sheets API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Sync status
export async function GET() {
  try {
    const settings = await db.appSettings.findFirst();
    if (!settings) return NextResponse.json({ connected: false });
    return NextResponse.json({
      connected: settings.googleSheetConnected,
      lastSyncAt: settings.lastSyncAt,
      lastSyncStatus: settings.lastSyncStatus,
      lastSyncMessage: settings.lastSyncMessage,
      autoSync: settings.autoSync,
      syncInterval: settings.syncInterval,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function detectSheetType(sheetName: string, headers: string[]): string | null {
  const name = sheetName.toLowerCase();
  const h = headers.join(' ');
  if (name.includes('payment') || name.includes('received') || name.includes('income') || (h.includes('party') && h.includes('amount') && !h.includes('type'))) return 'payment';
  if (name.includes('expense') || name.includes('spent') || name.includes('cost') || (h.includes('title') && h.includes('amount'))) return 'expense';
  if (name.includes('client') || name.includes('party') || name.includes('customer') || (h.includes('name') && h.includes('phone'))) return 'client';
  if (name.includes('site') || name.includes('project') || name.includes('work')) return 'site';
  if (name.includes('labour') || name.includes('worker') || name.includes('employee') || (h.includes('name') && (h.includes('wage') || h.includes('salary')))) return 'labour';
  if (name.includes('receivable') || name.includes('due') || name.includes('pending')) return 'receivable';
  if (name.includes('task') || name.includes('todo')) return 'task';
  return null;
}

// Import Main sheet (business transactions with Expense/Payment Received)
async function importMainSheet(headers: string[], rows: any[][]): Promise<number> {
  let imported = 0;
  const h = headers.map(x => x.toLowerCase().trim());
  
  // Map column indices
  const colIdx: Record<string, number> = {};
  h.forEach((val, i) => {
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

  // Get or create managers
  const managers: Record<string, string> = {};
  for (const name of ['Gulshan', 'Rohit']) {
    let m = await db.manager.findFirst({ where: { name } });
    if (!m) m = await db.manager.create({ data: { name, role: 'partner', status: 'active' } });
    managers[name] = m.id;
  }

  // Get all sites for mapping
  const allSites = await db.site.findMany({ select: { id: true, name: true } });
  const siteMap: Record<string, string> = {};
  allSites.forEach(s => { siteMap[s.name.toLowerCase()] = s.id; });

  for (const row of rows) {
    try {
      const type = colIdx.type !== undefined ? String(row[colIdx.type] || '').trim() : '';
      const amountVal = colIdx.amount !== undefined ? row[colIdx.amount] : 0;
      const amount = parseFloat(String(amountVal || '0').replace(/[,₹]/g, '')) || 0;
      if (!amount || !type) continue;

      const dateVal = colIdx.date !== undefined ? row[colIdx.date] : null;
      let date: Date | undefined;
      if (dateVal) {
        date = new Date(dateVal);
        if (isNaN(date.getTime())) date = undefined;
      }

      const category = colIdx.category !== undefined ? String(row[colIdx.category] || '').trim() : '';
      const description = colIdx.description !== undefined ? String(row[colIdx.description] || '').trim() : '';
      const labour = colIdx.labour !== undefined ? String(row[colIdx.labour] || '').trim() : '';
      const siteName = colIdx.site !== undefined ? String(row[colIdx.site] || '').trim() : '';
      const party = colIdx.party !== undefined ? String(row[colIdx.party] || '').trim() : '';
      const user = colIdx.user !== undefined ? String(row[colIdx.user] || '').trim() : '';

      const managerId = user && managers[user] ? managers[user] : null;
      const partner = user || null;
      const siteId = siteName ? siteMap[siteName.toLowerCase()] : undefined;

      if (type === 'Payment Received') {
        // Check for duplicate
        const dup = await db.payment.findFirst({
          where: {
            party,
            amount,
            date: date ? new Date(date) : undefined,
          },
        });
        if (!dup) {
          await db.payment.create({
            data: {
              party: party || 'Unknown',
              amount,
              date: date || new Date(),
              mode: 'cash',
              category: category !== 'N/A' ? category : 'Payment Received',
              siteId,
              managerId,
              partner,
              notes: description,
            },
          });
          imported++;
        }
      } else if (type === 'Expense') {
        const dup = await db.expense.findFirst({
          where: {
            title: description || category,
            amount,
            date: date ? new Date(date) : undefined,
          },
        });
        if (!dup) {
          await db.expense.create({
            data: {
              title: description || category,
              amount,
              date: date || new Date(),
              category: category !== 'N/A' ? category : 'Other',
              paidTo: labour || null,
              mode: 'cash',
              siteId,
              managerId,
              partner,
              notes: description,
            },
          });
          imported++;
        }
      }
    } catch (e) {
      // Skip row on error
    }
  }
  return imported;
}

// Import reference sheets (Sites, Labour, Parties, Categories)
async function importReferenceSheet(sheetName: string, headers: string[], rows: any[][]): Promise<number> {
  let imported = 0;
  const h = headers.map(x => x.toLowerCase().trim());
  const nameIdx = h.findIndex(x => x.includes('name') || x.includes('site') || x.includes('labour') || x.includes('party') || x.includes('category'));

  if (nameIdx === -1) return 0;

  for (const row of rows) {
    try {
      const name = String(row[nameIdx] || '').trim();
      if (!name) continue;

      if (sheetName.toLowerCase() === 'sites') {
        const dup = await db.site.findFirst({ where: { name } });
        if (!dup) {
          await db.site.create({ data: { name, status: 'active' } });
          imported++;
        }
      } else if (sheetName.toLowerCase() === 'labour') {
        const dup = await db.labour.findFirst({ where: { name } });
        if (!dup) {
          await db.labour.create({ data: { name, role: 'worker', status: 'active' } });
          imported++;
        }
      } else if (sheetName.toLowerCase() === 'parties' || sheetName.toLowerCase() === 'clients') {
        const dup = await db.client.findFirst({ where: { name } });
        if (!dup) {
          await db.client.create({ data: { name, type: 'customer', status: 'active' } });
          imported++;
        }
      } else if (sheetName.toLowerCase() === 'categories') {
        // Categories are just stored as reference data in expenses, no separate model
        imported++;
      }
    } catch {
      // Skip
    }
  }
  return imported;
}

const HEADER_MAPS: Record<string, Record<string, string>> = {
  payment: {
    party: 'party', name: 'party', from: 'party', client: 'client',
    amount: 'amount', received: 'amount', total: 'amount', rupees: 'amount',
    date: 'date', 'payment date': 'date',
    mode: 'mode', method: 'mode', type: 'type',
    reference: 'reference', ref: 'reference', utr: 'reference', 'transaction id': 'reference',
    notes: 'notes', remark: 'notes', description: 'notes',
    category: 'category', head: 'category',
    partner: 'partner', user: 'partner',
  },
  expense: {
    title: 'title', description: 'title', item: 'title', particular: 'title', expense: 'title',
    amount: 'amount', rupees: 'amount', total: 'amount', cost: 'amount',
    date: 'date', 'expense date': 'date',
    category: 'category', head: 'category', type: 'category',
    paidto: 'paidTo', 'paid to': 'paidTo', vendor: 'paidTo', supplier: 'paidTo', labour: 'paidTo',
    mode: 'mode', method: 'mode',
    billno: 'billNo', 'bill no': 'billNo', 'bill number': 'billNo', invoice: 'billNo',
    notes: 'notes', remark: 'notes',
    partner: 'partner', user: 'partner',
    site: 'siteId',
  },
  client: {
    name: 'name', client: 'name', party: 'name', customer: 'name',
    phone: 'phone', mobile: 'phone', contact: 'phone', number: 'phone',
    email: 'email', mail: 'email',
    address: 'address', location: 'address',
    gst: 'gstNumber', gstno: 'gstNumber', 'gst number': 'gstNumber',
    type: 'type', category: 'type',
  },
};

async function importSheetData(type: string, headers: string[], rows: any[][]): Promise<number> {
  const headerMap = HEADER_MAPS[type] || {};
  let imported = 0;
  const fieldMap: Record<number, string> = {};
  headers.forEach((h, i) => {
    const n = h.toLowerCase().trim();
    if (headerMap[n]) fieldMap[i] = headerMap[n];
  });

  // Get managers for partner mapping
  const managers = await db.manager.findMany({ where: { role: 'partner' } });
  const managerMap: Record<string, string> = {};
  managers.forEach(m => { managerMap[m.name] = m.id; });

  for (const row of rows) {
    try {
      const record: any = {};
      for (const [ci, fn] of Object.entries(fieldMap)) {
        const val = row[parseInt(ci)];
        if (val !== undefined && val !== '') {
          if (fn === 'amount') record[fn] = parseFloat(String(val).replace(/[,₹]/g, '')) || 0;
          else if (fn === 'date') { const d = new Date(val); if (!isNaN(d.getTime())) record[fn] = d; }
          else record[fn] = String(val).trim();
        }
      }

      // Add partner mapping from managerId or partner field
      if (record.partner && managerMap[record.partner]) {
        record.managerId = managerMap[record.partner];
      }

      if (type === 'payment' && (!record.party || !record.amount)) continue;
      if (type === 'expense' && (!record.title || !record.amount)) continue;
      if (type === 'client' && !record.name) continue;

      switch (type) {
        case 'payment': {
          if (record.party && record.amount) {
            const dup = await db.payment.findFirst({
              where: { party: record.party, amount: record.amount, date: record.date },
            });
            if (!dup) { await db.payment.create({ data: record }); imported++; }
          }
          break;
        }
        case 'expense': {
          if (record.title && record.amount) {
            const dup = await db.expense.findFirst({
              where: { title: record.title, amount: record.amount, date: record.date },
            });
            if (!dup) { await db.expense.create({ data: record }); imported++; }
          }
          break;
        }
        case 'client': {
          const dup = await db.client.findFirst({ where: { name: record.name } });
          if (!dup) { await db.client.create({ data: record }); imported++; }
          break;
        }
        default: imported++;
      }
    } catch { /* skip row */ }
  }
  return imported;
}
