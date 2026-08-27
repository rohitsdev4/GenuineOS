'use client';

import { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, FileText, Download, IndianRupee, ReceiptText,
  Loader2, Paperclip, Check,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DataTable } from '@/components/shared/data-table';
import { useFetchData, useCreateData, useUpdateData, useDeleteData, useSettings } from '@/hooks/use-data';
import { formatCurrency, formatDate, parseIndianNumber } from '@/lib/helpers';
import { useToast } from '@/hooks/use-toast';
import type { ColumnDef } from '@tanstack/react-table';

interface EstimateItem {
  description: string;
  qty: number;
  rate: number;
}

interface EstimateRow {
  id: string;
  number: string;
  type: 'estimate' | 'quotation' | 'invoice';
  title: string;
  clientId: string | null;
  clientName: string;
  siteId: string | null;
  date: string;
  validUntil: string | null;
  items: EstimateItem[];
  taxRate: number;
  discount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'invoiced'];
const TYPES = ['estimate', 'quotation', 'invoice'] as const;

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  sent: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  accepted: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
  invoiced: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

const typeLabels: Record<string, string> = {
  estimate: 'Estimate',
  quotation: 'Quotation',
  invoice: 'Invoice',
};

interface FormState {
  id: string | null;
  type: 'estimate' | 'quotation' | 'invoice';
  title: string;
  clientId: string;
  date: string;
  validUntil: string;
  status: string;
  items: EstimateItem[];
  taxRate: number;
  discount: number;
  notes: string;
}

const emptyForm: FormState = {
  id: null,
  type: 'estimate',
  title: '',
  clientId: '',
  date: new Date().toISOString().slice(0, 10),
  validUntil: '',
  status: 'draft',
  items: [{ description: '', qty: 1, rate: 0 }],
  taxRate: 18,
  discount: 0,
  notes: '',
};

function computeTotals(form: FormState) {
  const subtotal = form.items.reduce((sum, it) => sum + (it.qty || 0) * (it.rate || 0), 0);
  const taxable = Math.max(0, subtotal - (form.discount || 0));
  const taxAmount = Math.round(taxable * ((form.taxRate || 0) / 100) * 100) / 100;
  const total = Math.round((taxable + taxAmount) * 100) / 100;
  return { subtotal, taxable, taxAmount, total };
}

export default function EstimatesTab() {
  const { data, isLoading } = useFetchData({ model: 'estimate', sortBy: 'createdAt', sortOrder: 'desc', limit: 1000 });
  const { data: clientsData } = useFetchData({ model: 'client', limit: 500 });
  const createMutation = useCreateData();
  const updateMutation = useUpdateData();
  const deleteMutation = useDeleteData();
  const { data: settings } = useSettings();
  const currency = settings?.currency || '₹';
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<EstimateRow | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const clients = useMemo(() => (Array.isArray(clientsData) ? clientsData : []), [clientsData]);
  const rows: EstimateRow[] = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.number, r.title, r.clientName, r.status].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [rows, search, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const accepted = rows.filter((r) => r.status === 'accepted' || r.status === 'invoiced');
    const pending = rows.filter((r) => r.status === 'draft' || r.status === 'sent');
    return {
      count: rows.length,
      totalValue: rows.reduce((s, r) => s + r.total, 0),
      acceptedValue: accepted.reduce((s, r) => s + r.total, 0),
      pendingValue: pending.reduce((s, r) => s + r.total, 0),
    };
  }, [rows]);

  const openNew = () => {
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setDialogOpen(true);
  };

  const openEdit = (r: EstimateRow) => {
    setForm({
      id: r.id,
      type: r.type,
      title: r.title,
      clientId: r.clientId || '',
      date: r.date.slice(0, 10),
      validUntil: r.validUntil ? r.validUntil.slice(0, 10) : '',
      status: r.status,
      items: r.items.length ? r.items.map((it) => ({ ...it })) : [{ description: '', qty: 1, rate: 0 }],
      taxRate: r.taxRate,
      discount: r.discount,
      notes: r.notes || '',
    });
    setDialogOpen(true);
  };

  const updateItem = (idx: number, patch: Partial<EstimateItem>) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { description: '', qty: 1, rate: 0 }] }));
  const removeItem = (idx: number) =>
    setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items }));

  const handleSave = () => {
    if (!form.title.trim()) {
      toast({ title: 'Validation Error', description: 'Title is required.', variant: 'destructive' });
      return;
    }
    const cleanItems = form.items
      .filter((it) => it.description.trim())
      .map((it) => ({ description: it.description.trim(), qty: Math.max(1, it.qty || 1), rate: it.rate || 0 }));
    if (!cleanItems.length) {
      toast({ title: 'Validation Error', description: 'Add at least one line item.', variant: 'destructive' });
      return;
    }
    const totals = computeTotals(form);
    const client = clients.find((c: any) => c.id === form.clientId);
    const payload = {
      type: form.type,
      title: form.title.trim(),
      clientId: form.clientId && form.clientId !== '__none__' ? form.clientId : null,
      clientName: client ? client.name : '',
      date: form.date,
      validUntil: form.validUntil || null,
      items: cleanItems,
      taxRate: form.taxRate || 0,
      discount: form.discount || 0,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      status: form.status,
      notes: form.notes.trim() || null,
      updatedAt: new Date().toISOString(),
    };
    if (form.id) {
      updateMutation.mutate(
        { model: 'estimate', id: form.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: 'Success', description: 'Estimate updated successfully.' });
            setDialogOpen(false);
          },
          onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
        }
      );
    } else {
      createMutation.mutate(
        { model: 'estimate', data: { ...payload, createdAt: new Date().toISOString() } },
        {
          onSuccess: () => {
            toast({ title: 'Success', description: 'Estimate saved — all data stored locally.' });
            setDialogOpen(false);
          },
          onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
        }
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { model: 'estimate', id: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: 'Success', description: 'Estimate deleted.' });
          setDeleteTarget(null);
        },
        onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const downloadPdf = async (r: EstimateRow) => {
    setDownloadingId(r.id);
    try {
      const business = {
        name: settings.businessName || 'GenuineOS Business',
        address: settings.businessAddress || undefined,
        phone: settings.businessPhone || undefined,
        email: settings.businessEmail || undefined,
      };
      const res = await fetch('/api/files/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: r.type,
          payload: {
            docNumber: r.number,
            date: r.date.slice(0, 10),
            dueDays: r.type === 'invoice' ? 15 : undefined,
            business,
            client: { name: r.clientName || 'Walk-in Client' },
            items: r.items,
            taxRate: r.taxRate,
            discount: r.discount,
            notes: r.notes || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      const a = document.createElement('a');
      a.href = `data:${data.mime};base64,${data.base64}`;
      a.download = data.filename || `${r.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: 'Downloaded', description: `${data.filename} generated.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to generate PDF.', variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  const totals = computeTotals(form);

  const columns: ColumnDef<EstimateRow>[] = [
    {
      accessorKey: 'number',
      header: 'Number',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.number}</span>,
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.title}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.clientName || '—'}</p>
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => <Badge className="border bg-muted/40 text-muted-foreground">{typeLabels[row.original.type]}</Badge>,
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.date)}</span>,
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => <span className="font-semibold tabular-nums">{formatCurrency(row.original.total, currency)}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge className={`border capitalize ${statusColors[row.original.status] || statusColors.draft}`}>{row.original.status}</Badge>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" title="Download PDF" onClick={() => downloadPdf(row.original)} disabled={downloadingId === row.original.id}>
            {downloadingId === row.original.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="size-8" title="Edit" onClick={() => openEdit(row.original)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-500" title="Delete" onClick={() => setDeleteTarget(row.original)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total Documents</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{stats.count}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-500"><ReceiptText className="size-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="mt-1 truncate text-lg font-bold tabular-nums">{formatCurrency(stats.totalValue, currency)}</p>
            </div>
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-500"><IndianRupee className="size-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Accepted / Invoiced</p>
              <p className="mt-1 truncate text-lg font-bold tabular-nums text-emerald-500">{formatCurrency(stats.acceptedValue, currency)}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-500"><FileText className="size-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Draft / Sent (Pending)</p>
              <p className="mt-1 truncate text-lg font-bold tabular-nums text-amber-500">{formatCurrency(stats.pendingValue, currency)}</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-500"><Paperclip className="size-5" /></div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchable
        searchPlaceholder="Search number, title, client, status..."
        loading={isLoading}
        onAdd={openNew}
        addLabel="New Estimate"
        emptyIcon={ReceiptText}
        emptyTitle="No estimates yet"
        emptyDescription="Create your first estimate, quotation or invoice — all data is saved locally."
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border p-1">
              {['all', ...TYPES].map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    typeFilter === t ? 'bg-emerald-500 text-white' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t === 'all' ? 'All Types' : typeLabels[t]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {['all', ...STATUSES].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs capitalize transition-colors ${
                    statusFilter === s ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="size-4 text-emerald-500" />
              {form.id ? 'Edit Document' : 'New Estimate / Quotation / Invoice'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as FormState['type'] }))}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Site material supply — Phase 1" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={form.clientId} onValueChange={(v) => setForm((f) => ({ ...f, clientId: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— No client —</SelectItem>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
              </div>
            </div>

            <Separator />

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                  <Plus className="size-3.5" /> Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {form.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_64px_96px_32px] items-center gap-2">
                    <Input
                      value={it.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      placeholder="Description"
                      className="min-w-0 text-sm"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={it.qty}
                      onChange={(e) => updateItem(idx, { qty: parseIndianNumber(e.target.value) || 1 })}
                      placeholder="Qty"
                      className="text-sm tabular-nums"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={it.rate}
                      onChange={(e) => updateItem(idx, { rate: parseIndianNumber(e.target.value) || 0 })}
                      placeholder="Rate"
                      className="text-sm tabular-nums"
                    />
                    <Button type="button" variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-500" onClick={() => removeItem(idx)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax Rate (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.taxRate}
                  onChange={(e) => setForm((f) => ({ ...f, taxRate: parseIndianNumber(e.target.value) || 0 }))}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label>Discount (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.discount}
                  onChange={(e) => setForm((f) => ({ ...f, discount: parseIndianNumber(e.target.value) || 0 }))}
                  className="tabular-nums"
                />
              </div>
            </div>

            {/* Live totals */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(totals.subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="tabular-nums">− {formatCurrency(form.discount || 0, currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({form.taxRate || 0}%)</span>
                <span className="tabular-nums">+ {formatCurrency(totals.taxAmount, currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums text-emerald-500">{formatCurrency(totals.total, currency)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Payment terms, validity, T&C..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="gap-1.5">
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              {form.id ? 'Update' : 'Save Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `${deleteTarget.number} — ${deleteTarget.title} will be permanently removed. This cannot be undone.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              {deleteMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
