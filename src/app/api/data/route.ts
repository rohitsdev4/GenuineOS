import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Dynamic model resolver
function getModel(name: string) {
  const key = name === 'settings' ? 'appSettings' : name;
  return (db as any)[key];
}

const DATE_FIELDS = ['date', 'dueDate', 'followUpDate', 'reminderAt', 'startDate', 'endDate', 'joinDate', 'completedAt'];

// Simple in-memory cache for expensive queries (10s TTL)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 10000;
function cached(key: string, fn: () => Promise<any>) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return Promise.resolve(hit.data);
  return fn().then(data => { cache.set(key, { data, ts: Date.now() }); return data; });
}

function processDates(data: any) {
  const processed = { ...data };
  for (const field of DATE_FIELDS) {
    if (processed[field] && typeof processed[field] === 'string') {
      processed[field] = new Date(processed[field]);
    }
  }
  return processed;
}

// GET
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model');
    const id = searchParams.get('id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const include = searchParams.get('include') || '';
    const filterField = searchParams.get('filterField') || '';
    const filterValue = searchParams.get('filterValue') || '';
    const filterField2 = searchParams.get('filterField2') || '';
    const filterValue2 = searchParams.get('filterValue2') || '';

    const modelRef = getModel(model || '');
    if (!model || !modelRef) {
      return NextResponse.json({ error: 'Invalid model' }, { status: 400 });
    }

    if (id) {
      const inc = include ? include.split(',').reduce((a: any, k: string) => { a[k.trim()] = true; return a; }, {}) : undefined;
      const record = await modelRef.findUnique({ where: { id }, include: inc });
      return NextResponse.json(record);
    }

    // Enhanced summary with partner/site/category breakdowns (cached for speed)
    if (searchParams.get('summary') === 'true') {
      return cached('summary', async () => {
      const hasManager = !!((db as any).manager);

      const aggregates: Promise<any>[] = [
        db.payment.aggregate({ _sum: { amount: true }, _count: true }),
        db.expense.aggregate({ _sum: { amount: true }, _count: true }),
        db.receivable.aggregate({ _sum: { amount: true, receivedAmount: true } }),
      ];

      const [totalPayments, totalExpenses, totalReceivables, ...rest] = await Promise.all([
        ...aggregates,
        ...(hasManager ? [db.manager.findMany({ where: { status: 'active' } })] : [Promise.resolve([])]),
      ]);
      const managers = rest[0] || [];

      // Per-manager breakdown
      const managerStats = hasManager
        ? await Promise.all(managers.map(async (m: any) => {
            const [p, e] = await Promise.all([
              db.payment.aggregate({ where: { managerId: m.id }, _sum: { amount: true } }),
              db.expense.aggregate({ where: { managerId: m.id }, _sum: { amount: true } }),
            ]);
            return {
              id: m.id,
              name: m.name,
              totalPayments: p._sum.amount || 0,
              totalExpenses: e._sum.amount || 0,
              balance: (p._sum.amount || 0) - (e._sum.amount || 0),
            };
          }))
        : [];

      // Partner-wise breakdown (Gulshan, Rohit)
      const partnerBreakdown = await Promise.all(
        ['Gulshan', 'Rohit'].map(async (partner) => {
          const [p, e] = await Promise.all([
            db.payment.aggregate({ where: { partner }, _sum: { amount: true }, _count: true }),
            db.expense.aggregate({ where: { partner }, _sum: { amount: true }, _count: true }),
          ]);
          return {
            partner,
            totalPayments: p._sum.amount || 0,
            totalExpenses: e._sum.amount || 0,
            paymentCount: p._count || 0,
            expenseCount: e._count || 0,
            balance: (p._sum.amount || 0) - (e._sum.amount || 0),
          };
        })
      );

      // Per-site breakdown: for each site, total received (payments) and total expenses
      const allSites = await db.site.findMany({ select: { id: true, name: true } });
      const siteBreakdown = await Promise.all(
        allSites.map(async (site) => {
          const [payments, expenses] = await Promise.all([
            db.payment.aggregate({ where: { siteId: site.id }, _sum: { amount: true }, _count: true }),
            db.expense.aggregate({ where: { siteId: site.id }, _sum: { amount: true }, _count: true }),
          ]);
          const totalReceived = payments._sum.amount || 0;
          const totalExpenses = expenses._sum.amount || 0;
          return {
            siteId: site.id,
            siteName: site.name,
            totalReceived,
            totalExpenses,
            balance: totalReceived - totalExpenses,
            paymentCount: payments._count || 0,
            expenseCount: expenses._count || 0,
          };
        })
      );

      // Per-category expense breakdown
      const categoryBreakdown = await db.expense.groupBy({
        by: ['category'],
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      });

      const [recentPayments, recentExpenses, pendingTasks, overdueReceivables, activeSites] = await Promise.all([
        db.payment.findMany({
          take: 5, orderBy: { date: 'desc' },
          ...(hasManager ? { include: { manager: { select: { name: true } } } } : {}),
        }),
        db.expense.findMany({
          take: 5, orderBy: { date: 'desc' },
          ...(hasManager ? { include: { manager: { select: { name: true } } } } : {}),
        }),
        db.task.findMany({
          where: { status: { in: ['pending', 'in-progress'] } }, take: 5, orderBy: { dueDate: 'asc' },
        }),
        db.receivable.findMany({
          where: { status: { in: ['pending', 'partial'] }, dueDate: { lt: new Date() } },
        }),
        db.site.count({ where: { status: 'active' } }),
      ]);

      const totalReceived = totalPayments._sum.amount || 0;
      const totalExp = totalExpenses._sum.amount || 0;
      const totalRec = totalReceivables._sum.amount || 0;
      const receivedAmt = totalReceivables._sum.receivedAmount || 0;

      return NextResponse.json({
        totalReceived, totalExpenses: totalExp, totalReceivables: totalRec,
        receivedAmount: receivedAmt,
        pendingReceivables: totalRec - receivedAmt,
        balance: totalReceived - totalExp,
        totalPayments: totalPayments._count || 0,
        totalExpensesCount: totalExpenses._count || 0,
        totalLabour: await db.labour.count(),
        activeSites,
        managers: managerStats,
        partnerBreakdown,
        siteBreakdown,
        categoryBreakdown,
        recentPayments, recentExpenses, pendingTasks, overdueReceivables,
      });
      }); // end cached
    }

    // Count by status
    if (searchParams.get('countByStatus') === 'true') {
      const sf = searchParams.get('statusField') || 'status';
      const records = await modelRef.groupBy({ by: [sf], _count: true });
      return NextResponse.json(records);
    }

    // Category breakdown for reports
    if (searchParams.get('categoryBreakdown') === 'true') {
      const records = await modelRef.groupBy({
        by: ['category'],
        _sum: { amount: true },
        _count: true,
      });
      return NextResponse.json(records);
    }

    // Standard list
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } }, { title: { contains: search } },
        { party: { contains: search } }, { description: { contains: search } },
        { notes: { contains: search } }, { content: { contains: search } },
        { category: { contains: search } }, { paidTo: { contains: search } },
      ];
    }
    if (filterField && filterValue) {
      where[filterField] = filterValue;
    }
    if (filterField2 && filterValue2) {
      where[filterField2] = filterValue2;
    }

    const inc = include ? include.split(',').reduce((a: any, k: string) => { a[k.trim()] = true; return a; }, {}) : undefined;

    const [records, total] = await Promise.all([
      modelRef.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: [
          { [sortBy]: sortOrder as 'asc' | 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit, take: limit, include: inc,
      }),
      modelRef.count({ where: Object.keys(where).length > 0 ? where : undefined }),
    ]);

    return NextResponse.json({ data: records, total, page, limit });
  } catch (error: any) {
    console.error('GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create (with upsert support for habitLog)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, data, upsert } = body;
    const modelRef = getModel(model);
    if (!model || !modelRef) return NextResponse.json({ error: 'Invalid model' }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'No data' }, { status: 400 });

    const processed = processDates(data);

    // Upsert support for habitLog (unique on habitId+date)
    if (upsert && model === 'habitLog') {
      const record = await modelRef.upsert({
        where: { habitId_date: { habitId: processed.habitId, date: processed.date } },
        update: processed,
        create: processed,
      });
      return NextResponse.json(record, { status: 201 });
    }

    const record = await modelRef.create({ data: processed });
    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    console.error('POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, id, data } = body;
    const modelRef = getModel(model);
    if (!model || !modelRef || !id) return NextResponse.json({ error: 'Invalid model or id' }, { status: 400 });

    const record = await modelRef.update({ where: { id }, data: processDates(data) });
    return NextResponse.json(record);
  } catch (error: any) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model');
    const id = searchParams.get('id');
    const modelRef = getModel(model || '');
    if (!model || !modelRef || !id) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

    const record = await modelRef.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: record });
  } catch (error: any) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
