import { db, getTable, generateId, nowISO, toISO, createDefaultSettings } from './indexeddb';

// ── Types ──

export interface FetchParams {
  model: string;
  id?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  include?: string;
  filterField?: string;
  filterValue?: string;
  filterField2?: string;
  filterValue2?: string;
  summary?: boolean;
  countByStatus?: boolean;
  statusField?: string;
  categoryBreakdown?: boolean;
}

// ── Searchable fields per model ──

const SEARCHABLE_FIELDS: Record<string, string[]> = {
  manager: ['name', 'phone', 'notes'],
  client: ['name', 'phone', 'email', 'address', 'notes'],
  site: ['name', 'location', 'description', 'notes', 'contractor'],
  payment: ['party', 'notes', 'reference', 'category', 'partner'],
  sitePayment: ['notes', 'reference', 'category'],
  expense: ['title', 'notes', 'paidTo', 'category', 'billNo', 'partner'],
  receivable: ['party', 'description', 'notes', 'invoiceNo'],
  task: ['title', 'description', 'tags', 'assignee'],
  labour: ['name', 'phone', 'address', 'notes', 'role'],
  labourPayment: ['notes', 'reference', 'month'],
  attendance: ['notes'],
  extraWork: ['description', 'notes'],
  note: ['title', 'content', 'category'],
  habit: ['name', 'description', 'category'],
  habitLog: ['notes'],
};

// ── fetchData: main query function mirroring the Prisma API route ──

export async function fetchData(params: FetchParams): Promise<any> {
  const { model, id, page = 1, limit = 100, search, sortBy, sortOrder, include,
    filterField, filterValue, filterField2, filterValue2,
    summary, countByStatus, statusField, categoryBreakdown } = params;

  const table = getTable(model);
  if (!table) throw new Error(`Invalid model: ${model}`);

  // Single record by id
  if (id) {
    const record = await table.get(id);
    if (!record) throw new Error('Record not found');
    return record;
  }

  // Summary endpoint
  if (summary) {
    return getSummary();
  }

  // Count by status
  if (countByStatus) {
    const sf = statusField || 'status';
    const allRecords = await table.toArray();
    const counts: Record<string, number> = {};
    for (const r of allRecords) {
      const val = (r as any)[sf] || 'unknown';
      counts[val] = (counts[val] || 0) + 1;
    }
    // Return in Prisma groupBy format
    return Object.entries(counts).map(([key, _count]) => ({ [sf]: key, _count }));
  }

  // Category breakdown
  if (categoryBreakdown) {
    const allRecords = await table.toArray();
    const breakdown: Record<string, { category: string; _sum: { amount: number }; _count: number }> = {};
    for (const r of allRecords) {
      const cat = (r as any).category || 'uncategorized';
      if (!breakdown[cat]) {
        breakdown[cat] = { category: cat, _sum: { amount: 0 }, _count: 0 };
      }
      breakdown[cat]._sum.amount += Number((r as any).amount) || 0;
      breakdown[cat]._count++;
    }
    return Object.values(breakdown);
  }

  // Standard list with pagination, search, sort, filter
  let collection = table.toCollection();

  // Filter in-memory for complex queries
  let results = await collection.toArray();

  // Search filter
  if (search) {
    const q = search.toLowerCase();
    const fields = SEARCHABLE_FIELDS[model] || ['name', 'title', 'party', 'notes', 'content', 'description', 'category'];
    results = results.filter(r =>
      fields.some(f => {
        const val = (r as any)[f];
        return val && typeof val === 'string' && val.toLowerCase().includes(q);
      })
    );
  }

  // Field filters
  if (filterField && filterValue !== undefined && filterValue !== '') {
    results = results.filter(r => (r as any)[filterField] === filterValue);
  }
  if (filterField2 && filterValue2 !== undefined && filterValue2 !== '') {
    results = results.filter(r => (r as any)[filterField2] === filterValue2);
  }

  // Sort
  const sortKey = sortBy || 'createdAt';
  const sortDir = sortOrder === 'asc' ? 1 : -1;
  results.sort((a, b) => {
    const aVal = (a as any)[sortKey];
    const bVal = (b as any)[sortKey];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * sortDir;
    return String(aVal).localeCompare(String(bVal)) * sortDir;
  });

  const total = results.length;
  const offset = (page - 1) * limit;
  const paginated = results.slice(offset, offset + limit);

  // Handle include (basic: resolve relations by looking up ids)
  if (include) {
    const incFields = include.split(',').map(s => s.trim());
    const resolved = await Promise.all(
      paginated.map(async (r) => {
        const record: any = { ...r };
        for (const field of incFields) {
          const fkId = record[field + 'Id'] || record[field.toLowerCase() + 'Id'];
          if (fkId) {
            try {
              const relTable = getTable(field);
              if (relTable) {
                record[field] = await relTable.get(fkId);
              }
            } catch { /* relation table may not exist */ }
          }
        }
        return record;
      })
    );
    return { data: resolved, total, page, limit };
  }

  return { data: paginated, total, page, limit };
}

// ── CRUD Operations ──

export async function createRecord(model: string, data: any, upsert?: boolean): Promise<any> {
  const table = getTable(model);
  if (!table) {
    console.error('[createRecord] Invalid model:', model, '- table not found in Dexie DB');
    throw new Error(`Invalid model: ${model}`);
  }

  const now = nowISO();
  const record = {
    ...data,
    id: data.id || generateId(),
    createdAt: data.createdAt || now,
    updatedAt: now,
  };

  // Upsert support for habitLog (unique on habitId+date)
  if (upsert && model === 'habitLog') {
    const existing = await table.where({ habitId: record.habitId, date: record.date }).first();
    if (existing) {
      await table.update(existing.id, { ...record, id: existing.id, updatedAt: now });
      return table.get(existing.id);
    }
  }

  // Upsert support for settings
  if (upsert && model === 'settings') {
    const existing = await db.appSettings.get('main');
    if (existing) {
      await db.appSettings.update('main', { ...record, id: 'main', updatedAt: now });
      return db.appSettings.get('main');
    }
    // Set the main id
    record.id = 'main';
  }

  try {
    await table.put(record);
    return record;
  } catch (err) {
    console.error(`[createRecord] Dexie put() failed for model: ${model}, id: ${record.id}, error:`, err);
    throw err;
  }
}

export async function updateRecord(model: string, id: string, data: any): Promise<any> {
  const table = getTable(model);
  if (!table) {
    console.error('[updateRecord] Invalid model:', model, '- table not found in Dexie DB');
    throw new Error(`Invalid model: ${model}`);
  }

  const updatePayload = {
    ...data,
    updatedAt: nowISO(),
  };
  // Don't overwrite id or createdAt
  delete updatePayload.id;
  delete updatePayload.createdAt;

  try {
    await table.update(id, updatePayload);
    return table.get(id);
  } catch (err) {
    console.error(`[updateRecord] Dexie update() failed for model: ${model}, id: ${id}, error:`, err);
    throw err;
  }
}

export async function deleteRecord(model: string, id: string): Promise<any> {
  const table = getTable(model);
  if (!table) throw new Error(`Invalid model: ${model}`);

  const record = await table.get(id);
  await table.delete(id);
  return { success: true, deleted: record };
}

// ── Settings ──

export async function getSettings(): Promise<any> {
  let settings = await db.appSettings.get('main');
  if (!settings) {
    const defaults = createDefaultSettings();
    await db.appSettings.put(defaults);
    settings = defaults;
  }
  return settings;
}

export async function updateSettings(data: any): Promise<any> {
  const existing = await db.appSettings.get('main');
  if (!existing) {
    const defaults = createDefaultSettings();
    const merged = { ...defaults, ...data, id: 'main', updatedAt: nowISO() };
    await db.appSettings.put(merged);
    return merged;
  }
  const merged = { ...existing, ...data, id: 'main', updatedAt: nowISO() };
  await db.appSettings.put(merged);
  return merged;
}

// ── Dashboard Summary (mirrors the GET /api/data?summary=true response) ──

export async function getSummary(): Promise<any> {
  const [allPayments, allExpenses, allReceivables, allSites, allManagers,
    allTasks, allLabour, allRecentPayments, allRecentExpenses] = await Promise.all([
    db.payment.toArray(),
    db.expense.toArray(),
    db.receivable.toArray(),
    db.site.toArray(),
    db.manager.toArray(),
    db.task.toArray(),
    db.labour.toArray(),
    db.payment.orderBy('date').reverse().limit(5).toArray(),
    db.expense.orderBy('date').reverse().limit(5).toArray(),
  ]);

  // Total aggregates
  const totalReceived = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalExpenses = allExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalReceivables = allReceivables.reduce((s, r) => s + (r.amount || 0), 0);
  const receivedAmount = allReceivables.reduce((s, r) => s + (r.receivedAmount || 0), 0);

  // Active sites
  const activeSites = allSites.filter(s => s.status === 'active').length;

  // Active managers
  const activeManagers = allManagers.filter(m => m.status === 'active');

  // Per-manager breakdown
  const managerStats = activeManagers.map(m => {
    const mgrPayments = allPayments.filter(p => p.managerId === m.id).reduce((s, p) => s + (p.amount || 0), 0);
    const mgrExpenses = allExpenses.filter(e => e.managerId === m.id).reduce((s, e) => s + (e.amount || 0), 0);
    return {
      id: m.id,
      name: m.name,
      totalPayments: mgrPayments,
      totalExpenses: mgrExpenses,
      balance: mgrPayments - mgrExpenses,
    };
  });

  // Partner-wise breakdown
  const partnerBreakdown = ['Gulshan', 'Rohit'].map(partner => {
    const pPayments = allPayments.filter(p => p.partner === partner);
    const pExpenses = allExpenses.filter(e => e.partner === partner);
    const tp = pPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const te = pExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    return {
      partner,
      totalPayments: tp,
      totalExpenses: te,
      paymentCount: pPayments.length,
      expenseCount: pExpenses.length,
      balance: tp - te,
    };
  });

  // Per-site breakdown
  const siteBreakdown = allSites.map(site => {
    const sitePayments = allPayments.filter(p => p.siteId === site.id);
    const siteExpenses = allExpenses.filter(e => e.siteId === site.id);
    const totalReceived = sitePayments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalExp = siteExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    return {
      siteId: site.id,
      siteName: site.name,
      totalReceived,
      totalExpenses: totalExp,
      balance: totalReceived - totalExp,
      paymentCount: sitePayments.length,
      expenseCount: siteExpenses.length,
    };
  });

  // Category breakdown (expenses)
  const categoryMap: Record<string, { category: string; _sum: { amount: number }; _count: number }> = {};
  for (const e of allExpenses) {
    const cat = e.category || 'uncategorized';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { category: cat, _sum: { amount: 0 }, _count: 0 };
    }
    categoryMap[cat]._sum.amount += e.amount || 0;
    categoryMap[cat]._count++;
  }

  // Pending tasks
  const pendingTasks = allTasks
    .filter(t => t.status === 'pending' || t.status === 'in-progress')
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 5);

  // Overdue receivables
  const now = new Date().toISOString();
  const overdueReceivables = allReceivables.filter(
    r => (r.status === 'pending' || r.status === 'partial') && r.dueDate && r.dueDate < now
  );

  // Add manager names to recent payments/expenses
  const recentPayments = allRecentPayments.map(p => ({
    ...p,
    manager: p.managerId ? activeManagers.find(m => m.id === p.managerId) || null : null,
  }));
  const recentExpenses = allRecentExpenses.map(e => ({
    ...e,
    manager: e.managerId ? activeManagers.find(m => m.id === e.managerId) || null : null,
  }));

  return {
    totalReceived,
    totalExpenses,
    totalReceivables,
    receivedAmount,
    pendingReceivables: totalReceivables - receivedAmount,
    balance: totalReceived - totalExpenses,
    totalPayments: allPayments.length,
    totalExpensesCount: allExpenses.length,
    totalLabour: allLabour.length,
    activeSites,
    managers: managerStats,
    partnerBreakdown,
    siteBreakdown,
    categoryBreakdown: Object.values(categoryMap),
    recentPayments,
    recentExpenses,
    pendingTasks,
    overdueReceivables,
  };
}

// ── Deduplication ──

export async function deduplicatePayments(): Promise<number> {
  const all = await db.payment.orderBy('createdAt').toArray();
  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const p of all) {
    const dateStr = p.date ? new Date(p.date).toISOString().split('T')[0] : '';
    const key = `${(p.party || '').toLowerCase().trim()}|${p.amount}|${dateStr}`;
    if (seen.has(key)) {
      toDelete.push(p.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    await db.payment.bulkDelete(toDelete);
  }
  return toDelete.length;
}

export async function deduplicateExpenses(): Promise<number> {
  const all = await db.expense.orderBy('createdAt').toArray();
  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const e of all) {
    const dateStr = e.date ? new Date(e.date).toISOString().split('T')[0] : '';
    const key = `${(e.title || '').toLowerCase().trim()}|${e.amount}|${dateStr}`;
    if (seen.has(key)) {
      toDelete.push(e.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    await db.expense.bulkDelete(toDelete);
  }
  return toDelete.length;
}

// ── Sheet Data Import (called from client after receiving raw data from /api/sheets) ──

export async function importSheetData(sheetData: {
  payments: any[];
  expenses: any[];
  sites: any[];
  labour: any[];
  clients: any[];
  cleanSync?: boolean;
}): Promise<{ totalImported: number; sitesUpdated: number }> {
  let totalImported = 0;

  // Clear existing data if clean sync
  if (sheetData.cleanSync) {
    await db.payment.clear();
    await db.expense.clear();
  }

  // Import reference data first
  if (sheetData.sites && sheetData.sites.length > 0) {
    for (const site of sheetData.sites) {
      const existing = await db.site.where('name').equals(site.name).first();
      if (!existing) {
        await db.site.put({
          ...site,
          id: site.id || generateId(),
          contractValue: site.contractValue || 0,
          receivedAmount: site.receivedAmount || 0,
          pendingAmount: site.pendingAmount || 0,
          extraWorkAmount: site.extraWorkAmount || 0,
          extraWorkPaid: site.extraWorkPaid || 0,
          progress: site.progress || 0,
          status: site.status || 'active',
          createdAt: site.createdAt || nowISO(),
          updatedAt: nowISO(),
        });
        totalImported++;
      }
    }
  }

  if (sheetData.clients && sheetData.clients.length > 0) {
    for (const client of sheetData.clients) {
      const existing = await db.client.where('name').equals(client.name).first();
      if (!existing) {
        await db.client.put({
          ...client,
          id: client.id || generateId(),
          type: client.type || 'customer',
          status: client.status || 'active',
          createdAt: client.createdAt || nowISO(),
          updatedAt: nowISO(),
        });
        totalImported++;
      }
    }
  }

  if (sheetData.labour && sheetData.labour.length > 0) {
    for (const labour of sheetData.labour) {
      const existing = await db.labour.where('name').equals(labour.name).first();
      if (!existing) {
        await db.labour.put({
          ...labour,
          id: labour.id || generateId(),
          role: labour.role || 'worker',
          status: labour.status || 'active',
          dailyWage: labour.dailyWage || 0,
          monthlySalary: labour.monthlySalary || 0,
          advanceAmount: labour.advanceAmount || 0,
          skillLevel: labour.skillLevel || 'semi-skilled',
          createdAt: labour.createdAt || nowISO(),
          updatedAt: nowISO(),
        });
        totalImported++;
      }
    }
  }

  // Import transactions
  if (sheetData.payments && sheetData.payments.length > 0) {
    const paymentRecords = sheetData.payments.map(p => ({
      ...p,
      id: p.id || generateId(),
      amount: Number(p.amount) || 0,
      mode: p.mode || 'cash',
      createdAt: p.createdAt || nowISO(),
      updatedAt: nowISO(),
    }));
    await db.payment.bulkPut(paymentRecords);
    totalImported += paymentRecords.length;
  }

  if (sheetData.expenses && sheetData.expenses.length > 0) {
    const expenseRecords = sheetData.expenses.map(e => ({
      ...e,
      id: e.id || generateId(),
      amount: Number(e.amount) || 0,
      mode: e.mode || 'cash',
      category: e.category || 'general',
      createdAt: e.createdAt || nowISO(),
      updatedAt: nowISO(),
    }));
    await db.expense.bulkPut(expenseRecords);
    totalImported += expenseRecords.length;
  }

  // Update site financials
  let sitesUpdated = 0;
  const allSites = await db.site.toArray();
  const allPayments = await db.payment.toArray();
  const allExpenses = await db.expense.toArray();

  for (const site of allSites) {
    const sitePayments = allPayments.filter(p => p.siteId === site.id).reduce((s, p) => s + (p.amount || 0), 0);
    const pendingAmount = Math.max(0, (site.contractValue || 0) - sitePayments);
    if (site.receivedAmount !== sitePayments || site.pendingAmount !== pendingAmount) {
      await db.site.update(site.id, { receivedAmount: sitePayments, pendingAmount, updatedAt: nowISO() });
      sitesUpdated++;
    }
  }

  return { totalImported, sitesUpdated };
}
