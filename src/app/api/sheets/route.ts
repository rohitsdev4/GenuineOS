import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── Date normalization helpers ─────────────────────────────────────────

function normalizeDate(d: Date | string | undefined): Date | undefined {
  if (!d) return undefined;
  const date = new Date(d);
  if (isNaN(date.getTime())) return undefined;
  // Return start of day in local timezone
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(d: Date | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Deduplication utilities ────────────────────────────────────────────

async function deduplicatePayments(): Promise<number> {
  const all = await db.payment.findMany({ orderBy: { createdAt: 'asc' } });
  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const p of all) {
    const key = `${(p.party || '').toLowerCase().trim()}|${p.amount}|${dateKey(p.date)}`;
    if (seen.has(key)) {
      toDelete.push(p.id);
    } else {
      seen.add(key);
    }
  }
  if (toDelete.length > 0) {
    await db.payment.deleteMany({ where: { id: { in: toDelete } } });
  }
  return toDelete.length;
}

async function deduplicateExpenses(): Promise<number> {
  const all = await db.expense.findMany({ orderBy: { createdAt: 'asc' } });
  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const e of all) {
    const key = `${(e.title || '').toLowerCase().trim()}|${e.amount}|${dateKey(e.date)}`;
    if (seen.has(key)) {
      toDelete.push(e.id);
    } else {
      seen.add(key);
    }
  }
  if (toDelete.length > 0) {
    await db.expense.deleteMany({ where: { id: { in: toDelete } } });
  }
  return toDelete.length;
}

// ── Update site financials after sync ──────────────────────────────────

async function updateSiteFinancials(): Promise<number> {
  const allSites = await db.site.findMany({ select: { id: true } });
  let updated = 0;

  for (const site of allSites) {
    // Sum all payments linked to this site
    const paymentsAgg = await db.payment.aggregate({
      where: { siteId: site.id },
      _sum: { amount: true },
    });

    // Sum all expenses linked to this site
    const expensesAgg = await db.expense.aggregate({
      where: { siteId: site.id },
      _sum: { amount: true },
    });

    const totalReceived = paymentsAgg._sum.amount || 0;
    const totalExpenses = expensesAgg._sum.amount || 0;

    // Read current contractValue to calculate pendingAmount
    const currentSite = await db.site.findUnique({ where: { id: site.id } });
    if (!currentSite) continue;

    const pendingAmount = Math.max(0, currentSite.contractValue - totalReceived);

    await db.site.update({
      where: { id: site.id },
      data: {
        receivedAmount: totalReceived,
        pendingAmount: pendingAmount,
      },
    });

    updated++;
  }

  return updated;
}

// ── POST - Sheet operations: connect, test, fetch, sync, deduplicate ───

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sheetId, apiKey } = body;

    let settings = await db.appSettings.findFirst();
    if (!settings) settings = await db.appSettings.create({ data: {} });

    const sid = sheetId || settings.googleSheetId;
    const key = apiKey || settings.googleApiKey;

    // Handle deduplicate action (can be called independently)
    if (action === 'deduplicate') {
      const paymentsRemoved = await deduplicatePayments();
      const expensesRemoved = await deduplicateExpenses();
      return NextResponse.json({
        success: true,
        message: `Removed ${paymentsRemoved} duplicate payments and ${expensesRemoved} duplicate expenses`,
        paymentsRemoved,
        expensesRemoved,
      });
    }

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
      let hasMainSheet = false;

      // First pass: check if a "Main" sheet exists
      for (const sheetName of sheetNames) {
        if (sheetName.toLowerCase() === 'main') {
          hasMainSheet = true;
          break;
        }
      }

      // ── CLEAN SYNC: Clear existing transactions before importing ──
      if (action === 'sync') {
        const deleteResult = await db.$transaction([
          db.payment.deleteMany({}),
          db.expense.deleteMany({}),
        ]);
        console.log(`[Sync] Cleared ${deleteResult[0].count} payments and ${deleteResult[1].count} expenses before reimport`);
      }

      // ── Pass 1: Import reference sheets first (sites, labour, parties) ──
      // This ensures reference data exists before we import transactions that link to them
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

        if (sheetName.toLowerCase() === 'sites' || sheetName.toLowerCase() === 'labour' || sheetName.toLowerCase() === 'parties' || sheetName.toLowerCase() === 'categories') {
          const imported = await importReferenceSheet(sheetName, headers, dataRows);
          totalImported += imported;
        }
      }

      // ── Pass 2: Import Main sheet (transactions) after reference data is ready ──
      for (const sheetName of sheetNames) {
        if (sheetName.toLowerCase() !== 'main') continue;
        if (action !== 'sync') continue;

        const sheetData = allData[sheetName];
        if (!sheetData || sheetData.length === 0) continue;

        const headers = sheetData[0].headers;
        // Re-fetch data rows from allData (they were stored earlier)
        const range = encodeURIComponent(`${sheetName}!A1:ZZ`);
        const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${range}?key=${key}`;
        const dataRes = await fetch(dataUrl);
        if (!dataRes.ok) continue;
        const data = await dataRes.json();
        const rows = (data.values || []).slice(1).filter((r: any[]) => r.some((cell: any) => cell !== ''));

        const imported = await importMainSheet(headers, rows);
        totalImported += imported;
      }

      // ── Pass 3: Import other auto-detected sheets (skip payment/expense if Main exists) ──
      for (const sheetName of sheetNames) {
        if (sheetName.toLowerCase() === 'main') continue;
        if (sheetName.toLowerCase() === 'sites' || sheetName.toLowerCase() === 'labour' || sheetName.toLowerCase() === 'parties' || sheetName.toLowerCase() === 'categories') continue;

        const sheetData = allData[sheetName];
        if (!sheetData || sheetData.length === 0) continue;

        const headers = sheetData[0].headers;
        const detectedType = detectSheetType(sheetName, headers);
        if (detectedType && action === 'sync') {
          // Skip payment/expense auto-detection if Main sheet was processed
          if ((detectedType === 'payment' || detectedType === 'expense') && hasMainSheet) {
            continue;
          }
          // Re-fetch data rows
          const range = encodeURIComponent(`${sheetName}!A1:ZZ`);
          const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${range}?key=${key}`;
          const dataRes = await fetch(dataUrl);
          if (!dataRes.ok) continue;
          const data = await dataRes.json();
          const dataRows = (data.values || []).slice(1).filter((r: any[]) => r.some((cell: any) => cell !== ''));

          const imported = await importSheetData(detectedType, headers, dataRows);
          totalImported += imported;
        }
      }

      // ── Update site financials after sync ──
      let sitesUpdated = 0;
      if (action === 'sync') {
        sitesUpdated = await updateSiteFinancials();
      }

      const now = new Date();
      await db.appSettings.update({
        where: { id: settings.id },
        data: {
          lastSyncAt: now,
          lastSyncStatus: 'success',
          lastSyncMessage: action === 'sync'
            ? `Clean sync: ${sheetNames.length} sheets, ${totalImported} records imported, ${sitesUpdated} sites updated`
            : `Fetched ${sheetNames.length} sheets`,
        },
      });

      return NextResponse.json({
        success: true,
        message: action === 'sync'
          ? `Synced! ${totalImported} records imported from ${sheetNames.length} sheets, ${sitesUpdated} sites financially updated`
          : `Fetched ${sheetNames.length} sheets. Use "Sync" to import data.`,
        sheets: allData,
        totalImported,
        sitesUpdated,
        cleanSync: action === 'sync',
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
  // Only detect non-transaction sheet types here
  // Payment/expense detection is skipped when Main sheet exists
  if (name.includes('client') || name.includes('party') || name.includes('customer') || (h.includes('name') && h.includes('phone'))) return 'client';
  if (name.includes('site') || name.includes('project') || name.includes('work')) return 'site';
  if (name.includes('labour') || name.includes('worker') || name.includes('employee') || (h.includes('name') && (h.includes('wage') || h.includes('salary')))) return 'labour';
  if (name.includes('receivable') || name.includes('due') || name.includes('pending')) return 'receivable';
  if (name.includes('task') || name.includes('todo')) return 'task';
  // Only detect payment/expense sheets if the sheet name is very explicit
  // (avoids false positives from sheets that have amount columns)
  if (name.includes('payment') || name.includes('received') || name.includes('income')) return 'payment';
  if (name.includes('expense') || name.includes('spent') || name.includes('cost')) return 'expense';
  return null;
}

// Import Main sheet (business transactions with Expense/Payment Received)
// In clean sync mode, no dedup check is needed since we cleared all records first
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

  // Get all clients for mapping (to link payments to clients)
  const allClients = await db.client.findMany({ select: { id: true, name: true } });
  const clientMap: Record<string, string> = {};
  allClients.forEach(c => { clientMap[c.name.toLowerCase()] = c.id; });

  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    await db.$transaction(async (tx: any) => {
      for (const row of batch) {
        try {
          const type = colIdx.type !== undefined ? String(row[colIdx.type] || '').trim() : '';
          const amountVal = colIdx.amount !== undefined ? row[colIdx.amount] : 0;
          const amount = parseFloat(String(amountVal || '0').replace(/[,₹]/g, '')) || 0;
          if (!amount || !type) continue;

          const dateVal = colIdx.date !== undefined ? row[colIdx.date] : null;
          const date = normalizeDate(dateVal);

          const category = colIdx.category !== undefined ? String(row[colIdx.category] || '').trim() : '';
          const description = colIdx.description !== undefined ? String(row[colIdx.description] || '').trim() : '';
          const labour = colIdx.labour !== undefined ? String(row[colIdx.labour] || '').trim() : '';
          const siteName = colIdx.site !== undefined ? String(row[colIdx.site] || '').trim() : '';
          const party = colIdx.party !== undefined ? String(row[colIdx.party] || '').trim() : '';
          const user = colIdx.user !== undefined ? String(row[colIdx.user] || '').trim() : '';

          const managerId = user && managers[user] ? managers[user] : null;
          const partner = user || null;
          const siteId = siteName ? siteMap[siteName.toLowerCase()] || null : null;

          // Client matching: try exact match, then case-insensitive
          let clientId: string | null = null;
          if (party) {
            clientId = clientMap[party.toLowerCase()] || null;
            if (!clientId) {
              const lowerParty = party.toLowerCase();
              for (const [key, val] of Object.entries(clientMap)) {
                if (key === lowerParty) { clientId = val; break; }
              }
            }
          }

          if (type === 'Payment Received') {
            await tx.payment.create({
              data: {
                party: party || 'Unknown',
                amount,
                date: date || new Date(),
                mode: 'cash',
                category: category !== 'N/A' ? category : 'Payment Received',
                siteId,
                clientId,
                managerId,
                partner,
                notes: description,
              },
            });
            imported++;
          } else if (type === 'Expense') {
            await tx.expense.create({
              data: {
                title: description || category || 'Other',
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
        } catch (e) {
          // Skip row on error
        }
      }
    });
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
          else if (fn === 'date') record[fn] = normalizeDate(val);
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
          // Clean sync - no dedup check needed
          if (record.party && record.amount) {
            await db.payment.create({ data: record });
            imported++;
          }
          break;
        }
        case 'expense': {
          // Clean sync - no dedup check needed
          if (record.title && record.amount) {
            await db.expense.create({ data: record });
            imported++;
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
