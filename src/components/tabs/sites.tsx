'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Building2, MapPin, Phone, User, CalendarDays, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useFetchData, useCreateData, useUpdateData, useDeleteData } from '@/hooks/use-data';
import { formatCurrency, formatDate, statusColors } from '@/lib/helpers';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Site {
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

interface SiteFinancials {
  totalReceived: number;
  totalExpenses: number;
  paymentCount: number;
  expenseCount: number;
  transactions: any[];
}

const emptyForm = {
  name: '',
  location: '',
  clientId: '',
  contractValue: '',
  contractor: '',
  contractorPhone: '',
  startDate: '',
  estimatedDays: '',
  notes: '',
};

function getProgressColorClass(progress: number): string {
  if (progress >= 75) return '[&>div]:bg-emerald-500';
  if (progress >= 40) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-blue-500';
}

export default function SitesTab() {
  const { data, isLoading } = useFetchData({ model: 'site', sortBy: 'createdAt', sortOrder: 'desc' });
  const { data: clientsData } = useFetchData({ model: 'client', limit: 200 });
  const { data: paymentsData } = useFetchData({ model: 'payment', sortBy: 'date', sortOrder: 'desc', limit: 1000 });
  const { data: expensesData } = useFetchData({ model: 'expense', sortBy: 'date', sortOrder: 'desc', limit: 1000 });
  const createMutation = useCreateData();
  const updateMutation = useUpdateData();
  const deleteMutation = useDeleteData();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);
  const [expandedSite, setExpandedSite] = useState<string | null>(null);

  const sites: Site[] = data?.data || data || [];
  const clients = clientsData?.data || [];
  const contractorSuggestions = useMemo(() => [...new Set(sites.filter(s => s.contractor).map(s => s.contractor!))], [sites]);

  // Calculate per-site financials dynamically from live payments and expenses
  const siteFinancials = useMemo(() => {
    const finances: Record<string, SiteFinancials> = {};

    (paymentsData?.data || []).forEach((p: any) => {
      if (p.siteId) {
        if (!finances[p.siteId]) finances[p.siteId] = { totalReceived: 0, totalExpenses: 0, paymentCount: 0, expenseCount: 0, transactions: [] };
        finances[p.siteId].totalReceived += p.amount || 0;
        finances[p.siteId].paymentCount++;
        finances[p.siteId].transactions.push({ type: 'payment', ...p });
      }
    });

    (expensesData?.data || []).forEach((e: any) => {
      if (e.siteId) {
        if (!finances[e.siteId]) finances[e.siteId] = { totalReceived: 0, totalExpenses: 0, paymentCount: 0, expenseCount: 0, transactions: [] };
        finances[e.siteId].totalExpenses += e.amount || 0;
        finances[e.siteId].expenseCount++;
        finances[e.siteId].transactions.push({ type: 'expense', ...e });
      }
    });

    // Sort transactions by date desc within each site
    Object.values(finances).forEach(f => {
      f.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return finances;
  }, [paymentsData, expensesData]);

  const filteredSites = useMemo(() => {
    return sites.filter((s: Site) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.location?.toLowerCase().includes(search.toLowerCase()) ||
        s.contractor?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sites, search, statusFilter]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingSite(null);
  };

  const handleAdd = () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation Error', description: 'Site name is required.', variant: 'destructive' });
      return;
    }
    createMutation.mutate(
      {
        model: 'site',
        data: {
          name: form.name.trim(),
          location: form.location.trim() || undefined,
          clientId: form.clientId || undefined,
          contractValue: Number(form.contractValue) || 0,
          contractor: form.contractor.trim() || undefined,
          contractorPhone: form.contractorPhone.trim() || undefined,
          startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
          estimatedDays: Number(form.estimatedDays) || undefined,
          notes: form.notes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Success', description: 'Site created successfully.' });
          resetForm();
          setAddOpen(false);
        },
        onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const handleEdit = () => {
    if (!form.name.trim() || !editingSite) return;
    updateMutation.mutate(
      {
        model: 'site',
        id: editingSite.id,
        data: {
          name: form.name.trim(),
          location: form.location.trim() || undefined,
          clientId: form.clientId || undefined,
          contractValue: Number(form.contractValue) || 0,
          contractor: form.contractor.trim() || undefined,
          contractorPhone: form.contractorPhone.trim() || undefined,
          startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
          estimatedDays: Number(form.estimatedDays) || undefined,
          notes: form.notes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Success', description: 'Site updated successfully.' });
          resetForm();
          setEditOpen(false);
        },
        onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { model: 'site', id: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: 'Success', description: 'Site deleted successfully.' });
          setDeleteTarget(null);
        },
        onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const openEdit = (site: Site) => {
    setEditingSite(site);
    setForm({
      name: site.name,
      location: site.location || '',
      clientId: site.clientId || '',
      contractValue: String(site.contractValue || ''),
      contractor: site.contractor || '',
      contractorPhone: site.contractorPhone || '',
      startDate: site.startDate ? site.startDate.split('T')[0] : '',
      estimatedDays: String(site.estimatedDays || ''),
      notes: site.notes || '',
    });
    setEditOpen(true);
  };

  const siteDialogFields = (prefix: string) => (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-name`}>
          Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id={`${prefix}-name`}
          placeholder="Site or project name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-location`}>Location</Label>
        <Input
          id={`${prefix}-location`}
          placeholder="Site location"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label>Client</Label>
        <Select value={form.clientId} onValueChange={(v) => setForm((f) => ({ ...f, clientId: v === 'none' ? '' : v }))}>
          <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {clients.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-value`}>Contract Value</Label>
        <Input
          id={`${prefix}-value`}
          type="number"
          placeholder="Contract value"
          value={form.contractValue}
          onChange={(e) => setForm((f) => ({ ...f, contractValue: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2 relative">
          <Label htmlFor={`${prefix}-contractor`}>Contractor</Label>
          <Input
            id={`${prefix}-contractor`}
            placeholder="Contractor name"
            value={form.contractor}
            onChange={(e) => setForm((f) => ({ ...f, contractor: e.target.value }))}
          />
          {form.contractor && contractorSuggestions.filter(c => c.toLowerCase().includes(form.contractor.toLowerCase())).length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
              {contractorSuggestions
                .filter(c => c.toLowerCase().includes(form.contractor.toLowerCase()))
                .slice(0, 6)
                .map((c) => (
                  <div
                    key={c}
                    className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
                    onMouseDown={() => setForm((f) => ({ ...f, contractor: c }))}
                  >
                    {c}
                  </div>
                ))}
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-contractorPhone`}>Contractor Phone</Label>
          <Input
            id={`${prefix}-contractorPhone`}
            placeholder="Phone number"
            value={form.contractorPhone}
            onChange={(e) => setForm((f) => ({ ...f, contractorPhone: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-startDate`}>Start Date</Label>
          <Input
            id={`${prefix}-startDate`}
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-estDays`}>Estimated Days</Label>
          <Input
            id={`${prefix}-estDays`}
            type="number"
            placeholder="Days"
            value={form.estimatedDays}
            onChange={(e) => setForm((f) => ({ ...f, estimatedDays: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-notes`}>Notes</Label>
        <Input
          id={`${prefix}-notes`}
          placeholder="Additional notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* ── Header: Search, Filter, Add ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search sites..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 rounded-lg border p-1">
            {['all', 'active', 'on-hold', 'completed'].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'ghost'}
                size="sm"
                className="h-8 text-xs capitalize"
                onClick={() => setStatusFilter(status)}
              >
                {status === 'on-hold' ? 'On Hold' : status}
              </Button>
            ))}
          </div>
        </div>
        <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Site
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Site / Project</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">{siteDialogFields('add')}</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setAddOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Create Site'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Site Cards Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-medium">No sites found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search or filter.'
              : 'Create your first site or project to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredSites.map((site: Site) => {
            const fin = siteFinancials[site.id] || { totalReceived: 0, totalExpenses: 0, paymentCount: 0, expenseCount: 0, transactions: [] };
            const balance = fin.totalReceived - fin.totalExpenses;
            const isExpanded = expandedSite === site.id;

            return (
              <Card key={site.id} className={cn('group transition-shadow hover:shadow-md', isExpanded && 'ring-1 ring-primary/20 shadow-md')}>
                <CardContent className="p-0">
                  {/* Clickable Header Area */}
                  <div
                    className="cursor-pointer select-none p-6 pb-4"
                    onClick={() => setExpandedSite(isExpanded ? null : site.id)}
                  >
                    {/* Header: Name + Status + Actions */}
                    <div className="mb-4 flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-semibold">{site.name}</h3>
                        {site.location && (
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {site.location}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={statusColors[site.status] || ''}>
                          {site.status}
                        </Badge>
                        <div
                          className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(site)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog open={deleteTarget?.id === site.id} onOpenChange={(v) => { if (!v) setDeleteTarget(null); else setDeleteTarget(site); }}>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Site</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>{site.name}</strong>? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDelete();
                                  }}
                                  className="bg-red-600 text-white hover:bg-red-700"
                                >
                                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>

                    {/* Contractor info */}
                    {(site.contractor || site.contractorPhone) && (
                      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {site.contractor && (
                          <p className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            {site.contractor}
                          </p>
                        )}
                        {site.contractorPhone && (
                          <p className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            {site.contractorPhone}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Progress</span>
                        <span className="text-xs font-medium">{site.progress || 0}%</span>
                      </div>
                      <Progress
                        value={site.progress || 0}
                        className={cn('h-2', getProgressColorClass(site.progress || 0))}
                      />
                    </div>

                    {/* Financial info — live data */}
                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Contract Value</p>
                        <p className="text-sm font-semibold">{formatCurrency(site.contractValue || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Received</p>
                        <p className="text-sm font-semibold text-emerald-500">
                          {formatCurrency(fin.totalReceived)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Expenses</p>
                        <p className="text-sm font-semibold text-red-500">
                          {formatCurrency(fin.totalExpenses)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className={cn('text-sm font-semibold', balance >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                          {formatCurrency(balance)}
                        </p>
                      </div>
                    </div>

                    {/* Transaction count + expand toggle */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                          {fin.paymentCount} {fin.paymentCount === 1 ? 'payment' : 'payments'}
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3 text-red-500" />
                          {fin.expenseCount} {fin.expenseCount === 1 ? 'expense' : 'expenses'}
                        </span>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform duration-200',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </div>
                  </div>

                  {/* ── Expanded Transactions Section ── */}
                  {isExpanded && (
                    <div className="border-t">
                      {fin.transactions.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          No transactions recorded for this site yet.
                        </div>
                      ) : (
                        <ScrollArea className="max-h-96">
                          <div className="px-6 py-3 space-y-1">
                            {fin.transactions.map((txn: any, idx: number) => (
                              <div
                                key={txn.id || idx}
                                className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={cn(
                                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                                    txn.type === 'payment'
                                      ? 'bg-emerald-500/10 text-emerald-500'
                                      : 'bg-red-500/10 text-red-500'
                                  )}>
                                    {txn.type === 'payment'
                                      ? <TrendingUp className="h-3.5 w-3.5" />
                                      : <TrendingDown className="h-3.5 w-3.5" />
                                    }
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">
                                      {txn.type === 'payment'
                                        ? (txn.partyName || txn.description || 'Payment')
                                        : (txn.category || txn.description || 'Expense')}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {formatDate(txn.date, 'DD MMM YYYY')}
                                      {txn.type === 'payment' && txn.partyName && (
                                        <span className="ml-1.5">from {txn.partyName}</span>
                                      )}
                                      {txn.type === 'expense' && txn.paidTo && (
                                        <span className="ml-1.5">to {txn.paidTo}</span>
                                      )}
                                      {txn.type === 'expense' && txn.category && (
                                        <span className="ml-1.5">· {txn.category}</span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <span className={cn(
                                  'shrink-0 font-semibold tabular-nums',
                                  txn.type === 'payment' ? 'text-emerald-500' : 'text-red-500'
                                )}>
                                  {txn.type === 'payment' ? '+' : '-'}{formatCurrency(txn.amount || 0)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}

                      {/* Summary footer */}
                      {fin.transactions.length > 0 && (
                        <>
                          <Separator />
                          <div className="flex items-center justify-between px-6 py-3 bg-muted/30 rounded-b-lg">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{fin.transactions.length} total transactions</span>
                              <Separator orientation="vertical" className="h-3" />
                              <span className="text-emerald-500">
                                {formatCurrency(fin.totalReceived)} received
                              </span>
                              <Separator orientation="vertical" className="h-3" />
                              <span className="text-red-500">
                                {formatCurrency(fin.totalExpenses)} spent
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Net:</span>
                              <span className={cn(
                                'text-sm font-bold tabular-nums',
                                balance >= 0 ? 'text-emerald-500' : 'text-red-500'
                              )}>
                                {formatCurrency(balance)}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Edit Site Dialog ── */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Site / Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">{siteDialogFields('edit')}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Update Site'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
