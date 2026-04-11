// Re-export everything from indexeddb.ts
// db.ts is kept for backwards compatibility only
export { db, generateId, nowISO, toISO, createDefaultSettings, getTable } from './indexeddb';
export type {
  AppSettings, Manager, Client, Site, Payment, SitePayment,
  Expense, Receivable, Task, Labour, LabourPayment, Attendance,
  ExtraWork, Note, Habit, HabitLog, ChatMessage
} from './indexeddb';
