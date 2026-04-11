# GenuineOS Worklog

---
Task ID: 1
Agent: Main
Task: Fix and complete all spreadsheet data sync, partner calculations, and tab enhancements

Work Log:
- Analyzed uploaded XLSX file (5 sheets: Main with 438 transactions, Categories, Labour, Sites, Parties)
- Fixed import-sheet/route.ts: removed broken `{ range: 1 }` for single-column sheets, used `readFileSync` + buffer for Turbopack compatibility
- Fixed dashboard.tsx: `managers` bug → `s.managers` reference, added "Import Data" button with Database icon
- Enhanced import-sheet to import Parties as Clients (12 clients created), link payments to clients (79/80 linked), link expenses to sites (354/358 linked)
- Added case-insensitive client matching for party names (e.g., "Rohit to me" → "Rohit to Rohit")
- Updated site financials after import (receivedAmount, pendingAmount for all 20 sites)
- Enhanced sites.tsx: live financial data from payments/expenses, expandable transaction list, per-site balance
- Enhanced clients.tsx: payment/receivable history per client, financial summary cards, expandable transaction details
- Enhanced payments.tsx: site filter dropdown, mutual exclusion with partner/category filters
- Enhanced expenses.tsx: site filter dropdown, site name badge in mobile view, Site column in desktop table
- Updated helpers.ts: expenseCategories now includes spreadsheet categories (Labour Payment, Travel, Daily Expense, Food, Material Purchased, Other, etc.)

Stage Summary:
- 438 transactions imported: 80 payments, 358 expenses
- Partner calculations verified: Gulshan ₹1,34,249 balance | Rohit ₹34,026 balance
- Total: ₹11,39,528 received, ₹9,71,253 expenses, ₹1,68,275 net balance
- 20 sites with financial data, 12 clients, 16 workers
- Build passes cleanly, all APIs responding correctly

---
Task ID: 2
Agent: Main
Task: Comprehensive testing and bug fixing — all tabs, functions, buttons, dashboards, entries

Work Log:
- Audited all 16 tab components, 4 API routes, hooks, stores, and lib files
- Read complete source code of every file to identify bugs

Bugs Found and Fixed:
1. **Dashboard: Dynamic Tailwind class** — `hover:${triggerColor}/10` won't compile with Tailwind JIT. Fixed by using explicit hover class map (TRIGGER_HOVER_MAP).
2. **Dashboard: Misleading partner select** — Receivable and Task dialogs showed partner selector but the models don't have a `partner` field. Removed the unused partner select from those two dialogs.
3. **Habits: Redundant ternary** — `count: habit.targetCount > 1 ? 1 : 1` always evaluated to 1. Simplified to `count: 1`.
4. **Diary: Shows materials/vehicles notes** — Diary fetched ALL notes including those with `category='material'` and `category='vehicle'` (used by Materials and Vehicles tabs). Added client-side filter to exclude those categories.
5. **Chat API: Incomplete MODEL_MAP** — MODEL_MAP was missing `receivable`, `labour`, and `note` entries. Added them. Also added receivable and labour to the SEARCH_DATA tool's search list.
6. **API: filterField2 unused** — The data API read `filterField2`/`filterValue2` params but never applied them to the where clause. Fixed. Also added support in the useFetchData hook.
7. **Sites: Delete dialog never opens (CRITICAL)** — `!!deleteTarget?.id === site.id` had operator precedence bug: `(!!deleteTarget?.id) === site.id` always evaluated to `false` (boolean vs string). Fixed to `deleteTarget?.id === site.id`.
8. **Labour: Edit worker wipes fields (DATA LOSS)** — When opening edit worker dialog, 6 fields (aadhaar, address, bankName, bankAccount, bankIfsc, notes) were hardcoded to empty strings instead of loading from worker data. Fixed to populate from worker object.
9. **Settings: setState during render** — Multiple state setters called directly in render body (not in useEffect). This violates React rules and causes unpredictable render cycles. Wrapped in useEffect.
10. **Calendar: Timezone date mismatch** — Used `toISOString().split('T')[0]` which converts to UTC, causing tasks to appear on wrong dates in non-UTC timezones (e.g., IST +5:30). Replaced with local date string function.

Stage Summary:
- 10 bugs found and fixed across 9 files
- Build passes cleanly (✓ Compiled successfully)
- No compilation errors or type errors
- All 16 tabs, 4 API routes, hooks, and stores verified
