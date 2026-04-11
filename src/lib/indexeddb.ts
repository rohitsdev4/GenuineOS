import Dexie, { type EntityTable } from 'dexie';

// ── Helper: generate UUID-compatible ID (matches Prisma cuid pattern) ──
export function generateId(): string {
  return crypto.randomUUID();
}

// ── Model interfaces matching Prisma schema exactly ──

export interface AppSettings {
  id: string;
  llmProvider: string;
  apiKey: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  thinkingEnabled: boolean;
  appName: string;
  theme: string;
  accentColor: string;
  currency: string;
  dateFormat: string;
  notificationsEnabled: boolean;
  taskReminders: boolean;
  paymentAlerts: boolean;
  businessName: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  businessEmail: string | null;
  businessGst: string | null;
  googleSheetId: string | null;
  googleApiKey: string | null;
  googleSheetConnected: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  autoSync: boolean;
  syncInterval: number;
  createdAt: string;
  updatedAt: string;
}

export interface Manager {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  type: string;
  status: string;
  creditLimit: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  id: string;
  name: string;
  location: string | null;
  clientId: string | null;
  contractor: string | null;
  contractorPhone: string | null;
  contractValue: number;
  receivedAmount: number;
  pendingAmount: number;
  extraWorkAmount: number;
  extraWorkPaid: number;
  status: string;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  estimatedDays: number | null;
  description: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  managerId: string | null;
  clientId: string | null;
  partner: string | null;
  party: string;
  amount: number;
  date: string;
  mode: string;
  reference: string | null;
  category: string | null;
  siteId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SitePayment {
  id: string;
  siteId: string;
  amount: number;
  date: string;
  mode: string;
  reference: string | null;
  category: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  managerId: string | null;
  partner: string | null;
  title: string;
  amount: number;
  date: string;
  category: string;
  paidTo: string | null;
  mode: string;
  billNo: string | null;
  billImage: string | null;
  notes: string | null;
  siteId: string | null;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Receivable {
  id: string;
  clientId: string | null;
  party: string;
  amount: number;
  dueDate: string | null;
  receivedAmount: number;
  status: string;
  description: string | null;
  invoiceNo: string | null;
  invoiceImage: string | null;
  priority: string;
  followUpDate: string | null;
  followUpNotes: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  dueTime: string | null;
  completedAt: string | null;
  tags: string | null;
  assignee: string | null;
  siteId: string | null;
  reminder: boolean;
  reminderAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Labour {
  id: string;
  name: string;
  phone: string | null;
  aadhaar: string | null;
  address: string | null;
  role: string;
  dailyWage: number;
  monthlySalary: number;
  bankName: string | null;
  bankAccount: string | null;
  bankIfsc: string | null;
  advanceAmount: number;
  siteId: string | null;
  status: string;
  skillLevel: string;
  joinDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabourPayment {
  id: string;
  labourId: string;
  amount: number;
  date: string;
  month: string | null;
  daysWorked: number;
  mode: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  labourId: string;
  date: string;
  present: boolean;
  hoursWorked: number;
  overtime: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExtraWork {
  id: string;
  siteId: string;
  description: string;
  amount: number;
  paidAmount: number;
  date: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  color: string;
  mood: string | null;
  isPinned: boolean;
  reminder: boolean;
  reminderAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  category: string;
  frequency: string;
  color: string;
  icon: string;
  targetCount: number;
  unit: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  completed: boolean;
  count: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Dexie Database ──

class GenuineDB extends Dexie {
  appSettings!: EntityTable<AppSettings, 'id'>;
  manager!: EntityTable<Manager, 'id'>;
  client!: EntityTable<Client, 'id'>;
  site!: EntityTable<Site, 'id'>;
  payment!: EntityTable<Payment, 'id'>;
  sitePayment!: EntityTable<SitePayment, 'id'>;
  expense!: EntityTable<Expense, 'id'>;
  receivable!: EntityTable<Receivable, 'id'>;
  task!: EntityTable<Task, 'id'>;
  labour!: EntityTable<Labour, 'id'>;
  labourPayment!: EntityTable<LabourPayment, 'id'>;
  attendance!: EntityTable<Attendance, 'id'>;
  extraWork!: EntityTable<ExtraWork, 'id'>;
  note!: EntityTable<Note, 'id'>;
  habit!: EntityTable<Habit, 'id'>;
  habitLog!: EntityTable<HabitLog, 'id'>;

  constructor() {
    super('GenuineOS');

    this.version(1).stores({
      appSettings: 'id',
      manager: 'id, name, status, role',
      client: 'id, name, status, type',
      site: 'id, name, status, clientId',
      payment: 'id, party, date, category, mode, siteId, clientId, managerId, partner',
      sitePayment: 'id, siteId, date, category, mode',
      expense: 'id, title, date, category, mode, siteId, managerId, partner, paidTo',
      receivable: 'id, party, status, priority, dueDate, clientId',
      task: 'id, title, status, priority, dueDate, siteId',
      labour: 'id, name, status, role, siteId',
      labourPayment: 'id, labourId, date, month, mode',
      attendance: 'id, labourId, date',
      extraWork: 'id, siteId, date',
      note: 'id, title, category, color',
      habit: 'id, name, category, status, frequency',
      habitLog: 'id, habitId, date',
    });
  }
}

export const db = new GenuineDB();

// ── Default settings factory ──

export function createDefaultSettings(): AppSettings {
  const now = new Date().toISOString();
  return {
    id: 'main',
    llmProvider: 'gemini',
    apiKey: null,
    model: 'gemini-2.0-flash-lite',
    temperature: 0.7,
    maxTokens: 4096,
    thinkingEnabled: false,
    appName: 'GenuineOS',
    theme: 'dark',
    accentColor: 'emerald',
    currency: '₹',
    dateFormat: 'DD/MM/YYYY',
    notificationsEnabled: true,
    taskReminders: true,
    paymentAlerts: true,
    businessName: null,
    businessPhone: null,
    businessAddress: null,
    businessEmail: null,
    businessGst: null,
    googleSheetId: null,
    googleApiKey: null,
    googleSheetConnected: false,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncMessage: null,
    autoSync: false,
    syncInterval: 60,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Table name resolver (model string → db table) ──

export function getTable(model: string): Dexie.Table<any, string> {
  const key = model === 'settings' ? 'appSettings' : model;
  return (db as any)[key];
}

// ── Date helpers ──

export function toISO(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function nowISO(): string {
  return new Date().toISOString();
}
