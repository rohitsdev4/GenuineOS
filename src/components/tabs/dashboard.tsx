'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee, Receipt, Wallet, CreditCard, TrendingDown, TrendingUp,
  ListTodo, HandCoins, Scale, Building2, RefreshCw, Loader2, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Users, Database,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useDashboardSummary, useCreateData, useSheetsSync, useSettings } from '@/hooks/use-data';
import { formatCurrency, formatDate, priorityColors, statusColors } from '@/lib/helpers';
import { useToast } from '@/hooks/use-toast';

// ── Types ─────────────────────────────────────────────────────────
interface Partner {
  partner: string;
  totalPayments: number;
  totalExpenses: number;
  paymentCount: number;
  expenseCount: number;
  balance: number;
}

interface SiteBreakdown {
  siteId: string;
  siteName: string;
  totalReceived: number;
  totalExpenses: number;
  balance: number;
  paymentCount: number;
  expenseCount: number;
}

interface RecentPayment {
  id: string;
  party: string;
  amount: number;
  date: string;
  mode: string;
  category: string;
  notes: string;
  manager: { name: string };
}

interface RecentExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  paidTo: string;
  mode: string;
  manager: { name: string };
}

interface PendingTask {
  id: string;
  title: string;
  priority: string;
  dueDate: string;
  status: string;
}

interface OverdueReceivable {
  id: string;
  party: string;
  amount: number;
  dueDate: string;
  status: string;
}

interface SummaryData {
  totalReceived: number;
  totalExpenses: number;
  balance: number;
  totalReceivables: number;
  receivedAmount: number;
  pendingReceivables: number;
  totalPayments: number;
  totalExpensesCount: number;
  totalLabour: number;
  activeSites: number;
  managers: any[];
  partnerBreakdown: Partner[];
  siteBreakdown: SiteBreakdown[];
  categoryBreakdown: { category: string; _sum: { amount: number }; _count: number }[];
  recentPayments: RecentPayment[];
  recentExpenses: RecentExpense[];
  pendingTasks: PendingTask[];
  overdueReceivables: OverdueReceivable[];
}

// ── Skeleton Loaders ──────────────────────────────────────────────
function ManagerCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-32" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="space-y-1 flex-1 min-w-0">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex items-center gap-2 ml-3">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────────────
function SummaryCard({
  title, amount, icon: Icon, color, subtext, loading,
}: {
  title: string; amount: number; icon: React.ElementType;
  color: string; subtext?: string; loading: boolean;
}) {
  const bgMap: Record<string, string> = {
    'text-emerald-500': 'bg-emerald-500/15',
    'text-red-500': 'bg-red-500/15',
    'text-blue-500': 'bg-blue-500/15',
    'text-purple-500': 'bg-purple-500/15',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <p className={`text-2xl font-bold tabular-nums ${color}`}>
                {formatCurrency(amount)}
              </p>
            )}
            {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
          </div>
          <div className={`rounded-full p-2.5 shrink-0 ${bgMap[color] || 'bg-muted'}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Partner Card ──────────────────────────────────────────────────
function PartnerCard({ partner, loading }: { partner: Partner; loading: boolean }) {
  const balanceColor = partner.balance >= 0 ? 'text-emerald-500' : 'text-red-500';
  const isGulshan = partner.partner === 'Gulshan';
  const gradientFrom = isGulshan ? 'from-blue-500/50' : 'from-amber-500/50';
  const gradientTo = isGulshan ? 'to-emerald-500/50' : 'to-orange-500/50';
  const avatarBg = isGulshan ? 'bg-blue-500/15' : 'bg-amber-500/15';
  const avatarColor = isGulshan ? 'text-blue-500' : 'text-amber-500';

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradientFrom} ${gradientTo}`} />
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${avatarBg}`}>
            <Wallet className={`h-5 w-5 ${avatarColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{partner.partner}</h3>
            <p className="text-xs text-muted-foreground truncate">{partner.paymentCount} payments · {partner.expenseCount} expenses</p>
          </div>
          <div className="shrink-0 text-right ml-2">
            <span className={`text-lg font-bold tabular-nums block ${balanceColor}`}>{formatCurrency(partner.balance)}</span>
            <p className="text-[10px] text-muted-foreground">Balance</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <p className="text-xs text-muted-foreground">Received</p>
            </div>
            {loading ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <p className="text-sm font-semibold text-emerald-500 tabular-nums">{formatCurrency(partner.totalPayments)}</p>
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" />
              <p className="text-xs text-muted-foreground">Expenses</p>
            </div>
            {loading ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <p className="text-sm font-semibold text-red-500 tabular-nums">{formatCurrency(partner.totalExpenses)}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Form Field ────────────────────────────────────────────────────
function FormField({
  label, htmlFor, required, children,
}: {
  label: string; htmlFor: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ── Quick Action Dialog ───────────────────────────────────────────
const TRIGGER_HOVER_MAP: Record<string, string> = {
  'text-emerald-500': 'hover:bg-emerald-500/10',
  'text-red-500': 'hover:bg-red-500/10',
  'text-amber-500': 'hover:bg-amber-500/10',
  'text-blue-500': 'hover:bg-blue-500/10',
};

function QuickActionDialog({
  title, triggerLabel, triggerIcon: TriggerIcon, triggerColor,
  fields, onSubmit, loading, partners, showPartnerSelect,
  selectedPartner, onPartnerChange,
}: {
  title: string;
  triggerLabel: string;
  triggerIcon: React.ElementType;
  triggerColor: string;
  fields: React.ReactNode;
  onSubmit: () => void;
  loading: boolean;
  partners: Partner[];
  showPartnerSelect?: boolean;
  selectedPartner?: string;
  onPartnerChange?: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const prevLoadingRef = React.useRef(false);

  // Auto-close dialog when loading transitions from true → false (mutation completed)
  React.useEffect(() => {
    if (prevLoadingRef.current && !loading && open) {
      setOpen(false);
    }
    prevLoadingRef.current = loading;
  }, [loading, open]);

  const hoverClass = TRIGGER_HOVER_MAP[triggerColor] || 'hover:bg-muted/50';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={`h-auto flex-col gap-2 py-4 text-xs font-medium ${hoverClass} transition-colors`}>
          <TriggerIcon className="h-5 w-5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          {showPartnerSelect && partners.length > 0 && (
            <FormField label="Partner" htmlFor={`${title}-partner`} required>
              <Select value={selectedPartner || ''} onValueChange={onPartnerChange}>
                <SelectTrigger id={`${title}-partner`}>
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.partner} value={p.partner}>{p.partner}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
          {fields}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onSubmit()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Mode Badge ────────────────────────────────────────────────────
function ModeBadge({ mode }: { mode: string }) {
  const colors: Record<string, string> = {
    cash: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    upi: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    bank: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    cheque: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    card: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    online: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colors[mode] || 'bg-muted text-muted-foreground'}`}>
      {mode}
    </Badge>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────
export default function DashboardTab() {
  const { data: summary, isLoading } = useDashboardSummary();
  const createMutation = useCreateData();
  const { toast } = useToast();
  const { syncSheets, isSyncing, lastSyncResult } = useSheetsSync();
  const { data: settings } = useSettings();

  const s = (summary || {}) as Partial<SummaryData>;
  const partners: Partner[] = s.partnerBreakdown || [];
  const siteBreakdown: SiteBreakdown[] = (s.siteBreakdown || []).filter((sb) => sb.paymentCount > 0 || sb.expenseCount > 0);
  const categoryBreakdown = s.categoryBreakdown || [];
  const recentPayments: RecentPayment[] = s.recentPayments || [];
  const recentExpenses: RecentExpense[] = s.recentExpenses || [];
  const pendingTasks: PendingTask[] = s.pendingTasks || [];
  const overdueReceivables: OverdueReceivable[] = s.overdueReceivables || [];

  const totalReceived = s.totalReceived || 0;
  const totalExpenses = s.totalExpenses || 0;
  const balance = totalReceived - totalExpenses;
  const activeSites = s.activeSites || 0;

  // Form states
  const [paymentForm, setPaymentForm] = useState({ party: '', amount: '', mode: 'cash', category: '', notes: '', partner: '' });
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', category: '', paidTo: '', mode: 'cash', notes: '', partner: '' });
  const [receivableForm, setReceivableForm] = useState({ party: '', amount: '', dueDate: '', priority: 'medium', description: '', partner: '' });
  const [taskForm, setTaskForm] = useState({ title: '', priority: 'medium', dueDate: '', description: '', partner: '' });

  const resetPaymentForm = () => setPaymentForm({ party: '', amount: '', mode: 'cash', category: '', notes: '', partner: '' });
  const resetExpenseForm = () => setExpenseForm({ title: '', amount: '', category: '', paidTo: '', mode: 'cash', notes: '', partner: '' });
  const resetReceivableForm = () => setReceivableForm({ party: '', amount: '', dueDate: '', priority: 'medium', description: '', partner: '' });
  const resetTaskForm = () => setTaskForm({ title: '', priority: 'medium', dueDate: '', description: '', partner: '' });

  // Show sync result toast
  useEffect(() => {
    if (lastSyncResult) {
      toast({
        title: 'Sheets Sync',
        description: lastSyncResult,
      });
    }
  }, [lastSyncResult, toast]);

  const handleCreate = useCallback((
    model: string,
    data: Record<string, unknown>,
    resetFn: () => void,
    displayName: string,
  ) => {
    if (!data.party && !data.title) {
      toast({ title: 'Validation Error', description: 'Please fill in the required fields.', variant: 'destructive' });
      return;
    }
    if (data.amount !== undefined && (!data.amount || Number(data.amount) <= 0)) {
      toast({ title: 'Validation Error', description: 'Please enter a valid amount.', variant: 'destructive' });
      return;
    }

    createMutation.mutate(
      { model, data },
      {
        onSuccess: () => {
          toast({ title: 'Success', description: `${displayName} created successfully.` });
          resetFn();
        },
        onError: (error: Error) => {
          console.error(`[Dashboard] Failed to create ${model}:`, error);
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
      },
    );
  }, [createMutation, toast]);

  const [isImporting, setIsImporting] = useState(false);

  const handleSync = useCallback(async () => {
    await syncSheets('sync');
  }, [syncSheets]);

  const handleImportData = useCallback(async () => {
    setIsImporting(true);
    try {
      const res = await fetch('/api/import-sheet', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Import Successful',
          description: `Imported ${data.summary?.paymentsImported || 0} payments, ${data.summary?.expensesImported || 0} expenses, ${data.summary?.clientsCreated || 0} clients`,
        });
        // Refresh all data
        window.location.reload();
      } else {
        toast({ title: 'Import Failed', description: data.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Import Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  }, [toast]);

  return (
    <div className="space-y-5 pb-8">
      {/* ── Header with Sync Button ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground truncate">
            {(s.managers && (s.managers as any[]).length > 0)
              ? `${(s.managers as any[]).length} manager${(s.managers as any[]).length > 1 ? 's' : ''} · ${activeSites} active site${activeSites !== 1 ? 's' : ''}`
              : 'Business overview and quick actions'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Connection status */}
          <div className="flex items-center gap-1.5 mr-1">
            <div className={`h-2 w-2 rounded-full shrink-0 ${settings?.googleSheetConnected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-muted-foreground/30'}`} />
            <span className="text-xs text-muted-foreground hidden md:inline">
              {settings?.googleSheetConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="shrink-0"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1.5" />
            )}
            <span className="hidden sm:inline">Sync Sheets</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleImportData}
            disabled={isImporting}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Database className="h-4 w-4 mr-1.5" />
            )}
            <span className="hidden sm:inline">Import Data</span>
          </Button>
        </div>
      </div>

      {/* ── Partner Cards ── */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Partner Balances
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isLoading ? (
            <>
              <ManagerCardSkeleton />
              <ManagerCardSkeleton />
            </>
          ) : partners.length > 0 ? (
            partners.map((p) => <PartnerCard key={p.partner} partner={p} loading={isLoading} />)
          ) : (
            <Card className="sm:col-span-2">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No partner data</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Import data from Google Sheets to see partner balances</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Financial Overview ── */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Financial Overview
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {isLoading ? (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </>
          ) : (
            <>
              <SummaryCard
                title="Total Received"
                amount={totalReceived}
                icon={IndianRupee}
                color="text-emerald-500"
                subtext={`${s.totalPayments || 0} payments`}
              />
              <SummaryCard
                title="Total Expenses"
                amount={totalExpenses}
                icon={Receipt}
                color="text-red-500"
                subtext={`${s.totalExpensesCount || 0} expenses`}
              />
              <SummaryCard
                title="Net Balance"
                amount={balance}
                icon={Scale}
                color={balance >= 0 ? 'text-blue-500' : 'text-red-500'}
                subtext={balance >= 0 ? 'Surplus' : 'Deficit'}
              />
              <SummaryCard
                title="Active Sites"
                amount={activeSites}
                icon={Building2}
                color="text-purple-500"
                subtext={s.totalLabour ? `${s.totalLabour} labour` : undefined}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Add Payment */}
          <QuickActionDialog
            title="Add Payment"
            triggerLabel="Add Payment"
            triggerIcon={CreditCard}
            triggerColor="text-emerald-500"
            loading={createMutation.isPending}
            partners={partners}
            showPartnerSelect
            selectedPartner={paymentForm.partner}
            onPartnerChange={(v) => setPaymentForm((p) => ({ ...p, partner: v }))}
            fields={
              <>
                <FormField label="Party" htmlFor="pay-party" required>
                  <Input
                    id="pay-party"
                    placeholder="Party / client name"
                    value={paymentForm.party}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, party: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </FormField>
                <FormField label="Amount (₹)" htmlFor="pay-amount" required>
                  <Input
                    id="pay-amount"
                    type="number"
                    placeholder="0"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Mode" htmlFor="pay-mode">
                    <Select value={paymentForm.mode} onValueChange={(v) => setPaymentForm((p) => ({ ...p, mode: v }))}>
                      <SelectTrigger id="pay-mode" className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Category" htmlFor="pay-category">
                    <Input
                      id="pay-category"
                      placeholder="e.g. Advance"
                      value={paymentForm.category}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, category: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </FormField>
                </div>
                <FormField label="Notes" htmlFor="pay-notes">
                  <Textarea
                    id="pay-notes"
                    placeholder="Optional notes"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))}
                    className="text-sm min-h-[60px] resize-none"
                  />
                </FormField>
              </>
            }
            onSubmit={() =>
              handleCreate(
                'payment',
                {
                  party: paymentForm.party,
                  amount: Number(paymentForm.amount),
                  mode: paymentForm.mode,
                  category: paymentForm.category || undefined,
                  notes: paymentForm.notes || undefined,
                  partner: paymentForm.partner || undefined,
                },
                resetPaymentForm,
                'Payment',
              )
            }
          />

          {/* Add Expense */}
          <QuickActionDialog
            title="Add Expense"
            triggerLabel="Add Expense"
            triggerIcon={TrendingDown}
            triggerColor="text-red-500"
            loading={createMutation.isPending}
            partners={partners}
            showPartnerSelect
            selectedPartner={expenseForm.partner}
            onPartnerChange={(v) => setExpenseForm((p) => ({ ...p, partner: v }))}
            fields={
              <>
                <FormField label="Title" htmlFor="exp-title" required>
                  <Input
                    id="exp-title"
                    placeholder="Expense title"
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, title: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </FormField>
                <FormField label="Amount (₹)" htmlFor="exp-amount" required>
                  <Input
                    id="exp-amount"
                    type="number"
                    placeholder="0"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Category" htmlFor="exp-category">
                    <Select value={expenseForm.category || 'general'} onValueChange={(v) => setExpenseForm((p) => ({ ...p, category: v }))}>
                      <SelectTrigger id="exp-category" className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['general', 'travel', 'food', 'materials', 'rent', 'salary', 'fuel', 'maintenance', 'tools', 'equipment', 'electricity', 'tax', 'other'].map((c) => (
                          <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Mode" htmlFor="exp-mode">
                    <Select value={expenseForm.mode} onValueChange={(v) => setExpenseForm((p) => ({ ...p, mode: v }))}>
                      <SelectTrigger id="exp-mode" className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
                <FormField label="Paid To" htmlFor="exp-paidTo">
                  <Input
                    id="exp-paidTo"
                    placeholder="Payee name"
                    value={expenseForm.paidTo}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, paidTo: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </FormField>
                <FormField label="Notes" htmlFor="exp-notes">
                  <Textarea
                    id="exp-notes"
                    placeholder="Optional notes"
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))}
                    className="text-sm min-h-[60px] resize-none"
                  />
                </FormField>
              </>
            }
            onSubmit={() =>
              handleCreate(
                'expense',
                {
                  title: expenseForm.title,
                  amount: Number(expenseForm.amount),
                  category: expenseForm.category || 'general',
                  paidTo: expenseForm.paidTo || undefined,
                  mode: expenseForm.mode,
                  notes: expenseForm.notes || undefined,
                  partner: expenseForm.partner || undefined,
                },
                resetExpenseForm,
                'Expense',
              )
            }
          />

          {/* Add Receivable */}
          <QuickActionDialog
            title="Add Receivable"
            triggerLabel="Add Receivable"
            triggerIcon={HandCoins}
            triggerColor="text-amber-500"
            loading={createMutation.isPending}
            partners={partners}
            fields={
              <>
                <FormField label="Party" htmlFor="recv-party" required>
                  <Input
                    id="recv-party"
                    placeholder="Party / client name"
                    value={receivableForm.party}
                    onChange={(e) => setReceivableForm((p) => ({ ...p, party: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </FormField>
                <FormField label="Amount (₹)" htmlFor="recv-amount" required>
                  <Input
                    id="recv-amount"
                    type="number"
                    placeholder="0"
                    value={receivableForm.amount}
                    onChange={(e) => setReceivableForm((p) => ({ ...p, amount: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Due Date" htmlFor="recv-dueDate">
                    <Input
                      id="recv-dueDate"
                      type="date"
                      value={receivableForm.dueDate}
                      onChange={(e) => setReceivableForm((p) => ({ ...p, dueDate: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </FormField>
                  <FormField label="Priority" htmlFor="recv-priority">
                    <Select value={receivableForm.priority} onValueChange={(v) => setReceivableForm((p) => ({ ...p, priority: v }))}>
                      <SelectTrigger id="recv-priority" className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
                <FormField label="Description" htmlFor="recv-desc">
                  <Textarea
                    id="recv-desc"
                    placeholder="Optional description"
                    value={receivableForm.description}
                    onChange={(e) => setReceivableForm((p) => ({ ...p, description: e.target.value }))}
                    className="text-sm min-h-[60px] resize-none"
                  />
                </FormField>
              </>
            }
            onSubmit={() =>
              handleCreate(
                'receivable',
                {
                  party: receivableForm.party,
                  amount: Number(receivableForm.amount),
                  dueDate: receivableForm.dueDate ? new Date(receivableForm.dueDate).toISOString() : undefined,
                  priority: receivableForm.priority,
                  description: receivableForm.description || undefined,
                },
                resetReceivableForm,
                'Receivable',
              )
            }
          />

          {/* Add Task */}
          <QuickActionDialog
            title="Add Task"
            triggerLabel="Add Task"
            triggerIcon={ListTodo}
            triggerColor="text-blue-500"
            loading={createMutation.isPending}
            partners={partners}
            fields={
              <>
                <FormField label="Title" htmlFor="task-title" required>
                  <Input
                    id="task-title"
                    placeholder="Task title"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Priority" htmlFor="task-priority">
                    <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((p) => ({ ...p, priority: v }))}>
                      <SelectTrigger id="task-priority" className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Due Date" htmlFor="task-dueDate">
                    <Input
                      id="task-dueDate"
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </FormField>
                </div>
                <FormField label="Description" htmlFor="task-desc">
                  <Textarea
                    id="task-desc"
                    placeholder="Optional description"
                    value={taskForm.description}
                    onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                    className="text-sm min-h-[60px] resize-none"
                  />
                </FormField>
              </>
            }
            onSubmit={() =>
              handleCreate(
                'task',
                {
                  title: taskForm.title,
                  priority: taskForm.priority,
                  dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : undefined,
                  description: taskForm.description || undefined,
                },
                resetTaskForm,
                'Task',
              )
            }
          />
        </div>
      </div>

      <Separator />

      {/* ── Recent Activity ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Payments */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              Recent Payments
              {!isLoading && recentPayments.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px] font-normal">
                  {recentPayments.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <div className="space-y-1">
                {[...Array(5)].map((_, i) => <ActivityRowSkeleton key={i} />)}
              </div>
            ) : recentPayments.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <CreditCard className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No recent payments</p>
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto pr-1 space-y-0.5">
                {recentPayments.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0 border-border/50 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{p.party}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {p.date ? formatDate(p.date, 'DD MMM YYYY') : 'N/A'}
                        </span>
                        {p.manager?.name && (
                          <>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="text-[11px] text-muted-foreground">{p.manager.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-sm font-semibold text-emerald-500 tabular-nums whitespace-nowrap">
                        +{formatCurrency(p.amount)}
                      </span>
                      {p.mode && <ModeBadge mode={p.mode} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Expenses */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              Recent Expenses
              {!isLoading && recentExpenses.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px] font-normal">
                  {recentExpenses.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <div className="space-y-1">
                {[...Array(5)].map((_, i) => <ActivityRowSkeleton key={i} />)}
              </div>
            ) : recentExpenses.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <TrendingDown className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No recent expenses</p>
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto pr-1 space-y-0.5">
                {recentExpenses.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0 border-border/50 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{e.title}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {e.date ? formatDate(e.date, 'DD MMM YYYY') : 'N/A'}
                        </span>
                        {e.manager?.name && (
                          <>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="text-[11px] text-muted-foreground">{e.manager.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-sm font-semibold text-red-500 tabular-nums whitespace-nowrap">
                        -{formatCurrency(e.amount)}
                      </span>
                      {e.category && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50 text-muted-foreground hidden sm:inline-flex">
                          {e.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Pending Tasks & Overdue Receivables ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pending Tasks */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ListTodo className="h-4 w-4 text-amber-500" />
              Pending Tasks
              {!isLoading && pendingTasks.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px] font-normal">
                  {pendingTasks.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <div className="space-y-1">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                ))}
              </div>
            ) : pendingTasks.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <ListTodo className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">All tasks completed 🎉</p>
              </div>
            ) : (
              <div className="max-h-[240px] overflow-y-auto pr-1 space-y-1">
                {pendingTasks.slice(0, 8).map((t) => {
                  const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between rounded-lg border p-2.5 transition-colors ${
                        isOverdue ? 'border-red-500/20 bg-red-500/5' : 'border-border/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {t.dueDate && (
                            <span className={`text-[11px] ${isOverdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                              {formatDate(t.dueDate, 'DD MMM YYYY')}
                            </span>
                          )}
                          {isOverdue && (
                            <AlertTriangle className="h-3 w-3 text-red-400" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {t.status && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[t.status] || ''}`}>
                            {t.status}
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityColors[t.priority] || ''}`}>
                          {t.priority}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Receivables */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Overdue Receivables
              {!isLoading && overdueReceivables.length > 0 && (
                <Badge variant="destructive" className="ml-auto text-[10px] font-normal">
                  {overdueReceivables.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <div className="space-y-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : overdueReceivables.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <HandCoins className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No overdue receivables</p>
              </div>
            ) : (
              <div className="max-h-[240px] overflow-y-auto pr-1 space-y-1">
                {overdueReceivables.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 transition-colors"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-sm font-medium truncate">{r.party}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-red-400">
                          Due: {r.dueDate ? formatDate(r.dueDate, 'DD MMM YYYY') : 'N/A'}
                        </span>
                        {r.status && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[r.status] || ''}`}>
                            {r.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-red-500 tabular-nums whitespace-nowrap">
                      {formatCurrency(r.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
