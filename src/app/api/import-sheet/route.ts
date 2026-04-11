import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { readFileSync } from 'fs';

export async function POST() {
  try {
    const filePath = path.resolve('/home/z/my-project/upload/Telegram Expense Bot Setup (2).xlsx');
    const fileBuffer = readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // ===== 1. Create Managers (Partners) =====
    const managers: Record<string, { id: string; name: string }> = {};
    for (const name of ['Gulshan', 'Rohit']) {
      let m = await db.manager.findFirst({ where: { name } });
      if (!m) {
        m = await db.manager.create({
          data: { name, role: 'partner', status: 'active' },
        });
      }
      managers[name] = { id: m.id, name: m.name };
    }

    // ===== 2. Import Sites Sheet =====
    const sitesSheet = workbook.Sheets['Sites'];
    const sitesRaw = XLSX.utils.sheet_to_json<Record<string, any>>(sitesSheet);
    const siteMap: Record<string, string> = {};
    let sitesCreated = 0;
    let sitesExisting = 0;

    for (const row of sitesRaw) {
      // Handle single-column sheet: key is the header, value is the name
      const name = (row['Site Names'] || Object.values(row)[0])?.toString().trim();
      if (!name || name === 'Site Names') continue; // skip header row
      let site = await db.site.findFirst({ where: { name } });
      if (!site) {
        site = await db.site.create({
          data: { name, status: 'active' },
        });
        sitesCreated++;
      } else {
        sitesExisting++;
      }
      siteMap[name] = site.id;
    }

    // ===== 3. Import Parties Sheet as Clients =====
    const partiesSheet = workbook.Sheets['Parties'];
    const partiesRaw = XLSX.utils.sheet_to_json<Record<string, any>>(partiesSheet);
    const clientMap: Record<string, string> = {};
    let clientsCreated = 0;
    let clientsExisting = 0;

    for (const row of partiesRaw) {
      const name = (row['Party Names'] || Object.values(row)[0])?.toString().trim();
      if (!name || name === 'Party Names') continue; // skip header row
      let client = await db.client.findFirst({ where: { name } });
      if (!client) {
        client = await db.client.create({
          data: {
            name,
            type: 'customer',
            status: 'active',
          },
        });
        clientsCreated++;
      } else {
        clientsExisting++;
      }
      clientMap[name] = client.id;
    }

    // ===== 4. Import Labour Sheet (skip duplicates) =====
    const labourSheet = workbook.Sheets['Labour'];
    const labourRaw = XLSX.utils.sheet_to_json<Record<string, any>>(labourSheet);
    const labourMap: Record<string, string> = {};
    const seenLabourNames = new Set<string>();
    let labourCreated = 0;
    let labourExisting = 0;
    let labourSkipped = 0;

    for (const row of labourRaw) {
      const name = (row['Labour Names'] || Object.values(row)[0])?.toString().trim();
      if (!name || name === 'Labour Names') continue; // skip header row

      // Skip duplicates within the current batch (e.g., "Self Gulshan" appearing twice)
      if (seenLabourNames.has(name)) {
        labourSkipped++;
        continue;
      }
      seenLabourNames.add(name);

      let labour = await db.labour.findFirst({ where: { name } });
      if (!labour) {
        labour = await db.labour.create({
          data: { name, role: 'worker', status: 'active' },
        });
        labourCreated++;
      } else {
        labourExisting++;
      }
      labourMap[name] = labour.id;
    }

    // ===== 5. Clear existing imports (payments + expenses) =====
    const deleteResult = await db.$transaction([
      db.payment.deleteMany({}),
      db.expense.deleteMany({}),
    ]);

    // ===== 6. Import Main Transactions (Payments & Expenses) =====
    const mainSheet = workbook.Sheets['Main'];
    const mainData = XLSX.utils.sheet_to_json<Record<string, any>>(mainSheet);

    let paymentCount = 0;
    let expenseCount = 0;
    let paymentsLinkedToClient = 0;
    let paymentsLinkedToSite = 0;
    let expensesLinkedToSite = 0;

    const BATCH_SIZE = 50;

    for (let i = 0; i < mainData.length; i += BATCH_SIZE) {
      const batch = mainData.slice(i, i + BATCH_SIZE);

      await db.$transaction(async (tx: any) => {
        for (const row of batch) {
          const dateVal = row['Date'];
          const type = row['Type']?.toString().trim();
          const amount = parseFloat(row['Amount']) || 0;
          const rawCategory = row['Category']?.toString().trim() || '';
          const description = row['Discription']?.toString().trim() || row['Description']?.toString().trim() || '';
          const labourName = row['Labour']?.toString().trim() || '';
          const siteName = row['Site']?.toString().trim() || '';
          const partyName = row['Party']?.toString().trim() || '';
          const userName = row['User']?.toString().trim() || '';

          // Skip rows with no amount
          if (amount === 0) continue;

          // Parse date — handle Excel serial numbers, JS Date objects, and string dates
          let date: Date | undefined;
          if (dateVal) {
            if (typeof dateVal === 'number') {
              // Excel serial date: days since 1900-01-01 (with the 1900 leap year bug)
              date = new Date((dateVal - 25569) * 86400 * 1000);
            } else if (dateVal instanceof Date) {
              date = dateVal;
            } else {
              date = new Date(dateVal);
            }
          }

          const managerId = userName && managers[userName] ? managers[userName].id : null;
          const partner = userName || null;
          // Site matching: only link if the site name actually exists in our siteMap
          const siteId = siteName && siteMap[siteName] ? siteMap[siteName] : null;
          // Client matching: try exact match first, then case-insensitive
          let clientId: string | null = null;
          if (partyName) {
            clientId = clientMap[partyName] || null;
            if (!clientId) {
              const lowerParty = partyName.toLowerCase();
              for (const [key, val] of Object.entries(clientMap)) {
                if (key.toLowerCase() === lowerParty) { clientId = val; break; }
              }
            }
          }

          if (type === 'Payment Received') {
            // Category for payments: always "Payment Received"
            const category = 'Payment Received';

            await tx.payment.create({
              data: {
                party: partyName || 'Unknown',
                amount,
                date: date || new Date(),
                mode: 'cash',
                category,
                siteId: siteId || null,
                clientId: clientId || null,
                managerId: managerId || null,
                partner,
                notes: description,
              },
            });
            paymentCount++;
            if (clientId) paymentsLinkedToClient++;
            if (siteId) paymentsLinkedToSite++;

          } else if (type === 'Expense') {
            // Category for expenses: use as-is from the sheet
            const category = rawCategory && rawCategory !== 'N/A' ? rawCategory : 'Other';

            await tx.expense.create({
              data: {
                title: description || category,
                amount,
                date: date || new Date(),
                category,
                paidTo: labourName || null,
                mode: 'cash',
                siteId: siteId || null,
                managerId: managerId || null,
                partner,
                notes: description,
              },
            });
            expenseCount++;
            if (siteId) expensesLinkedToSite++;
          }
        }
      });
    }

    // ===== 7. Update Site Financials =====
    // For each site, calculate total received (payments) and update receivedAmount / pendingAmount
    const siteNames = Object.keys(siteMap);
    let sitesFinanciallyUpdated = 0;

    for (const siteName of siteNames) {
      const siteId = siteMap[siteName];

      // Sum all payments linked to this site
      const paymentsAgg = await db.payment.aggregate({
        where: { siteId },
        _sum: { amount: true },
      });

      // Sum all expenses linked to this site
      const expensesAgg = await db.expense.aggregate({
        where: { siteId },
        _sum: { amount: true },
      });

      const totalReceived = paymentsAgg._sum.amount || 0;
      const totalExpenses = expensesAgg._sum.amount || 0;

      // Read current contractValue to calculate pendingAmount
      const currentSite = await db.site.findUnique({ where: { id: siteId } });
      if (!currentSite) continue;

      const pendingAmount = Math.max(0, currentSite.contractValue - totalReceived);

      await db.site.update({
        where: { id: siteId },
        data: {
          receivedAmount: totalReceived,
          pendingAmount: pendingAmount,
        },
      });

      sitesFinanciallyUpdated++;
    }

    // ===== 8. Return detailed summary =====
    return NextResponse.json({
      success: true,
      message: 'Data imported successfully from all 5 sheets',
      summary: {
        managers: {
          total: Object.keys(managers).length,
          names: Object.keys(managers),
        },
        sites: {
          total: Object.keys(siteMap).length,
          created: sitesCreated,
          existing: sitesExisting,
          financiallyUpdated: sitesFinanciallyUpdated,
        },
        clients: {
          total: Object.keys(clientMap).length,
          created: clientsCreated,
          existing: clientsExisting,
        },
        labour: {
          total: Object.keys(labourMap).length,
          created: labourCreated,
          existing: labourExisting,
          duplicatesSkipped: labourSkipped,
        },
        transactions: {
          paymentsImported: paymentCount,
          paymentsLinkedToClient,
          paymentsLinkedToSite,
          expensesImported: expenseCount,
          expensesLinkedToSite,
          totalTransactions: paymentCount + expenseCount,
        },
        cleanup: {
          deletedPayments: deleteResult[0].count,
          deletedExpenses: deleteResult[1].count,
        },
      },
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
