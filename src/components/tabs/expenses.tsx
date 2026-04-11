'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Receipt, Plus, Search, Pencil, Trash2, Loader2, Repeat,
} from 'lucide-react';
import { useFetchData, useCreateData, useUpdateData, useDeleteData } from '@/hooks/use-data';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { expenseCategories, paymentModes, formatCurrency, formatDate } from '@/lib/helpers';

import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';

const categoryColors: Record<string, string> = {
  general: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  travel: 'bg-sky-500/15 text-sky-500 border-sky-500/20',
  food: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
  materials: 'bg-orange-500/15 text-orange-500 border-orange-500/20',
  rent: 'bg-violet-500/15 text-violet-500 border-violet-500/20',
  salary: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
  fuel: 'bg-red-500/15 text-red-500 border-red-500/20',
  maintenance: 'bg-teal-500/15 text-teal-500 border-teal-500/20',
  tools: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20',
  equipment: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/20',
  electricity: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/20',
  internet: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  phone: 'bg-purple-500/15 text-purple-500 border-purple-500/20',
  insurance: 'bg-pink-500/15 text-pink-500 border-pink-500/20',
  tax: 'bg-rose-500/15 text-rose-500 border-rose-500/20',
  other: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
};

const modeColors: Record<string, string> = {
  cash: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
  upi: 'bg-purple-500/15 text-purple-500 border-purple-500/20',
  bank: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  cheque: 'bg-orange-500/15 text-orange-500 border-orange-500/20',
  card: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/20',
  online: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/20',
};

interface ExpenseForm {
  title: string;
  amount: string;
  date: string;
  category: string;
  paidTo: string;
  mode: string;
  billNo: string;
  notes: string;
  isRecurring: boolean;
  siteId: string;
}

const emptyForm: ExpenseForm = {
  title: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  category: 'general',
  paidTo: '',
  mode: 'cash',
  billNo: '',
  notes: '',
  isRecurring: false,
  siteId: '',
};

export default function ExpensesTab() {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Data fetching
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const { data, isLoading } = useFetchData({
    model: 'expense',
    sortBy: 'date',
    sortOrder: 'desc',
    search: debouncedSearch || undefined,
    filterField: siteFilter ? 'siteId' : partnerFilter ? 'partner' : categoryFilter ? 'category' : undefined,
    filterValue: siteFilter || partnerFilter || categoryFilter || undefined,
  });

  const createMutation = useCreateData();
  const updateMutation = useUpdateData();
  const deleteMutation = useDeleteData();

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Forms
  const [addForm, setAddForm] = useState<ExpenseForm>({ ...emptyForm });
  const [editForm, setEditForm] = useState<ExpenseForm>({ ...emptyForm });

  const expenses = data?.data || [];
  const totalAmount = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

  // Sites dropdown
  const { data: sitesData } = useFetchData({ model: 'site', sortBy: 'createdAt', sortOrder: 'desc' });
  const sitesList = sitesData?.data || [];

  const siteNameMap: Record<string, string> = {};
  sitesList.forEach((s: any) => { siteNameMap[s.id] = s.name; });

  // Unique paidTo values for autocomplete
  const uniquePaidTo = useMemo(() => [...new Set(expenses.map((e: any) => e.paidTo).filter(Boolean))], [expenses]);

  const handleAdd = async () => {
    if (!addForm.title.trim() || !addForm.amount || Number(addForm.amount) <= 0) {
      toast({ title: 'Validation Error', description: 'Title and a valid amount are required.', variant: 'destructive' });
      return;
    }
    try {
      await createMutation.mutateAsync({
        model: 'expense',
        data: {
          title: addForm.title.trim(),
          amount: Number(addForm.amount),
          date: addForm.date ? new Date(addForm.date).toISOString() : undefined,
          category: addForm.category,
          paidTo: addForm.paidTo.trim() || undefined,
          mode: addForm.mode,
          billNo: addForm.billNo.trim() || undefined,
          notes: addForm.notes.trim() || undefined,
          isRecurring: addForm.isRecurring,
          siteId: addForm.siteId || undefined,
        },
      });
      toast({ title: 'Expense Added', description: `${addForm.title} - ${formatCurrency(Number(addForm.amount))}` });
      setAddForm({ ...emptyForm });
      setAddOpen(false);
    } catch (err) {
      console.error('Failed to add expense:', err);
      toast({ title: 'Error', description: `Failed to add expense: ${err instanceof Error ? err.message : 'Unknown error'}`, variant: 'destructive' });
    }
  };

  const handleEdit = async () => {
    if (!editForm.title.trim() || !editForm.amount || Number(editForm.amount) <= 0) {
      toast({ title: 'Validation Error', description: 'Title and a valid amount are required.', variant: 'destructive' });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        model: 'expense',
        id: selectedItem.id,
        data: {
          title: editForm.title.trim(),
          amount: Number(editForm.amount),
          date: editForm.date ? new Date(editForm.date).toISOString() : undefined,
          category: editForm.category,
          paidTo: editForm.paidTo.trim() || undefined,
          mode: editForm.mode,
          billNo: editForm.billNo.trim() || undefined,
          notes: editForm.notes.trim() || undefined,
          isRecurring: editForm.isRecurring,
          siteId: editForm.siteId || undefined,
        },
      });
      toast({ title: 'Expense Updated', description: `${editForm.title} - ${formatCurrency(Number(editForm.amount))}` });
      setEditOpen(false);
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to update expense:', err);
      toast({ title: 'Error', description: `Failed to update expense: ${err instanceof Error ? err.message : 'Unknown error'}`, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ model: 'expense', id: selectedItem.id });
      toast({ title: 'Expense Deleted', description: `Expense "${selectedItem.title}" has been removed.` });
      setDeleteOpen(false);
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to delete expense:', err);
      toast({ title: 'Error', description: `Failed to delete expense: ${err instanceof Error ? err.message : 'Unknown error'}`, variant: 'destructive' });
    }
  };

  const openEdit = (item: any) => {
    setSelectedItem(item);
    setEditForm({
      title: item.title || '',
      amount: String(item.amount || ''),
      date: item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0],
      category: item.category || 'general',
      paidTo: item.paidTo || '',
      mode: item.mode || 'cash',
      billNo: item.billNo || '',
      notes: item.notes || '',
      isRecurring: item.isRecurring || false,
      siteId: item.siteId || '',
    });
    setEditOpen(true);
  };

  const openDelete = (item: any) => {
    setSelectedItem(item);
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Expenses</h2>
          <p className="text-muted-foreground text-sm">Track and categorize business expenses</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
            <p className="text-xs text-red-500 font-medium">Total Expenses</p>
            <p className="text-lg font-bold text-red-500">{formatCurrency(totalAmount)}</p>
          </div>
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus className="size-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={partnerFilter || 'all'} onValueChange={(v) => { setPartnerFilter(v === 'all' ? '' : v); setCategoryFilter(''); setSiteFilter(''); }}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Partner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Partners</SelectItem>
            <SelectItem value="Gulshan">Gulshan</SelectItem>
            <SelectItem value="Rohit">Rohit</SelectItem>
          </SelectContent>
        </Select>
        <Select value={siteFilter || 'all'} onValueChange={(v) => { setSiteFilter(v === 'all' ? '' : v); setPartnerFilter(''); setCategoryFilter(''); }}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="All Sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            {sitesList.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter || 'all'} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPartnerFilter(''); setSiteFilter(''); }}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {expenseCategories.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses logged"
          description="Track your business expenses by category to monitor spending and optimize costs."
          action={
            <Button onClick={() => setAddOpen(true)} size="sm">
              <Plus className="size-4" />
              Add First Expense
            </Button>
          }
        />
      ) : isMobile ? (
        /* Mobile Card View */
        <>
        <p className="text-sm font-medium text-muted-foreground">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} · Total: {formatCurrency(totalAmount)}</p>
        <div className="space-y-3">
            {expenses.map((e: any, idx: number) => (
              <Card key={e.id} className="py-0">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 shrink-0">{idx + 1}</span>
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{e.title}</p>
                          {e.isRecurring && (
                            <Repeat className="size-3.5 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{formatDate(e.date)}</p>
                    </div>
                    <p className="text-lg font-bold text-red-500 ml-2 shrink-0">{formatCurrency(e.amount)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {e.partner && (
                      <Badge variant="secondary" className={e.partner === 'Gulshan' ? 'bg-blue-500/15 text-blue-500' : 'bg-amber-500/15 text-amber-500'}>{e.partner}</Badge>
                    )}
                    {e.siteId && <Badge variant="secondary">{siteNameMap[e.siteId] || 'Unknown Site'}</Badge>}
                    <Badge variant="outline" className={categoryColors[e.category] || categoryColors.other}>
                      {e.category}
                    </Badge>
                    <Badge variant="outline" className={modeColors[e.mode] || ''}>
                      {e.mode}
                    </Badge>
                    {e.paidTo && (
                      <span className="text-xs text-muted-foreground truncate">
                        Paid to: {e.paidTo}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 pt-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(e)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => openDelete(e)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        /* Desktop Table View */
        <>
        <p className="text-sm font-medium text-muted-foreground">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} · Total: {formatCurrency(totalAmount)}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">S.No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Paid To</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e: any, idx: number) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground text-xs font-mono">{idx + 1}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(e.date)}</TableCell>
                  <TableCell>
                    {e.partner && (
                      <Badge variant="outline" className={e.partner === 'Gulshan' ? 'bg-blue-500/15 text-blue-500 border-blue-500/20' : 'bg-amber-500/15 text-amber-500 border-amber-500/20'}>{e.partner}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{e.title}</span>
                      {e.isRecurring && <Repeat className="size-3.5 text-muted-foreground" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-500">
                    {formatCurrency(e.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={categoryColors[e.category] || categoryColors.other}>
                      {e.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {e.siteId ? (
                      <Badge variant="secondary">{siteNameMap[e.siteId] || 'Unknown Site'}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.paidTo || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={modeColors[e.mode] || ''}>
                      {e.mode}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(e)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => openDelete(e)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {/* Add Expense Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setAddForm({ ...emptyForm }); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Record a new business expense.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="add-title">Title *</Label>
              <Input
                id="add-title"
                placeholder="e.g. Cement purchase, Site lunch..."
                value={addForm.title}
                onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-amount">Amount *</Label>
                <Input
                  id="add-amount"
                  type="number"
                  placeholder="0"
                  min="0"
                  value={addForm.amount}
                  onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-date">Date</Label>
                <Input
                  id="add-date"
                  type="date"
                  value={addForm.date}
                  onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-category">Category</Label>
                <Select value={addForm.category} onValueChange={(v) => setAddForm({ ...addForm, category: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-mode">Mode</Label>
                <Select value={addForm.mode} onValueChange={(v) => setAddForm({ ...addForm, mode: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentModes.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Site</Label>
              <Select value={addForm.siteId || 'none'} onValueChange={(v) => setAddForm({ ...addForm, siteId: v === 'none' ? '' : v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sitesList.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 relative">
              <Label htmlFor="add-paidTo">Paid To</Label>
              <Input
                id="add-paidTo"
                placeholder="Vendor or person name"
                value={addForm.paidTo}
                onChange={(e) => setAddForm({ ...addForm, paidTo: e.target.value })}
                autoComplete="off"
              />
              {addForm.paidTo && uniquePaidTo.filter((v) => v.toLowerCase().includes(addForm.paidTo.toLowerCase())).length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {uniquePaidTo
                    .filter((v) => v.toLowerCase().includes(addForm.paidTo.toLowerCase()))
                    .slice(0, 6)
                    .map((v) => (
                      <div
                        key={v}
                        className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); setAddForm({ ...addForm, paidTo: v }); }}
                      >
                        {v}
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-billNo">Bill No</Label>
              <Input
                id="add-billNo"
                placeholder="Bill or invoice number"
                value={addForm.billNo}
                onChange={(e) => setAddForm({ ...addForm, billNo: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-notes">Notes</Label>
              <Textarea
                id="add-notes"
                placeholder="Any additional notes..."
                value={addForm.notes}
                onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="add-recurring"
                checked={addForm.isRecurring}
                onCheckedChange={(v) => setAddForm({ ...addForm, isRecurring: v })}
              />
              <Label htmlFor="add-recurring" className="cursor-pointer">Recurring expense</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setAddForm({ ...emptyForm }); }}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Add Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setSelectedItem(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update the expense details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                placeholder="e.g. Cement purchase, Site lunch..."
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-amount">Amount *</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  placeholder="0"
                  min="0"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-mode">Mode</Label>
                <Select value={editForm.mode} onValueChange={(v) => setEditForm({ ...editForm, mode: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentModes.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Site</Label>
              <Select value={editForm.siteId || 'none'} onValueChange={(v) => setEditForm({ ...editForm, siteId: v === 'none' ? '' : v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sitesList.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 relative">
              <Label htmlFor="edit-paidTo">Paid To</Label>
              <Input
                id="edit-paidTo"
                placeholder="Vendor or person name"
                value={editForm.paidTo}
                onChange={(e) => setEditForm({ ...editForm, paidTo: e.target.value })}
                autoComplete="off"
              />
              {editForm.paidTo && uniquePaidTo.filter((v) => v.toLowerCase().includes(editForm.paidTo.toLowerCase())).length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {uniquePaidTo
                    .filter((v) => v.toLowerCase().includes(editForm.paidTo.toLowerCase()))
                    .slice(0, 6)
                    .map((v) => (
                      <div
                        key={v}
                        className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); setEditForm({ ...editForm, paidTo: v }); }}
                      >
                        {v}
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-billNo">Bill No</Label>
              <Input
                id="edit-billNo"
                placeholder="Bill or invoice number"
                value={editForm.billNo}
                onChange={(e) => setEditForm({ ...editForm, billNo: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Any additional notes..."
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="edit-recurring"
                checked={editForm.isRecurring}
                onCheckedChange={(v) => setEditForm({ ...editForm, isRecurring: v })}
              />
              <Label htmlFor="edit-recurring" className="cursor-pointer">Recurring expense</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setSelectedItem(null); }}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Update Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setSelectedItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the expense &quot;{selectedItem?.title || ''}&quot; ({selectedItem ? formatCurrency(selectedItem.amount) : ''})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
