'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  IndianRupee, Plus, Search, Pencil, Trash2, Loader2,
} from 'lucide-react';
import { useFetchData, useCreateData, useUpdateData, useDeleteData } from '@/hooks/use-data';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { paymentModes, formatCurrency, formatDate } from '@/lib/helpers';

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
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';

const modeColors: Record<string, string> = {
  cash: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
  upi: 'bg-purple-500/15 text-purple-500 border-purple-500/20',
  bank: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  cheque: 'bg-orange-500/15 text-orange-500 border-orange-500/20',
  card: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/20',
  online: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/20',
};

interface PaymentForm {
  party: string;
  amount: string;
  date: string;
  mode: string;
  category: string;
  reference: string;
  notes: string;
}

const emptyForm: PaymentForm = {
  party: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  mode: 'cash',
  category: '',
  reference: '',
  notes: '',
};

function PartyAutocomplete({
  value,
  onChange,
  suggestions,
  inputId,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  inputId?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8),
    [suggestions, value],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={inputId}
        placeholder="Client or party name"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(suggestion);
                setOpen(false);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PaymentsTab() {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Data fetching
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const { data, isLoading } = useFetchData({
    model: 'payment',
    sortBy: 'date',
    sortOrder: 'desc',
    search: debouncedSearch || undefined,
    filterField: siteFilter ? 'siteId' : partnerFilter ? 'partner' : categoryFilter ? 'category' : undefined,
    filterValue: siteFilter || partnerFilter || categoryFilter || undefined,
  });

  const { data: clientsData } = useFetchData({ model: 'client', sortBy: 'createdAt', sortOrder: 'desc' });
  const { data: sitesData } = useFetchData({ model: 'site', sortBy: 'createdAt', sortOrder: 'desc' });
  const sitesList = sitesData?.data || [];

  const createMutation = useCreateData();
  const updateMutation = useUpdateData();
  const deleteMutation = useDeleteData();

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Forms
  const [addForm, setAddForm] = useState<PaymentForm>({ ...emptyForm });
  const [editForm, setEditForm] = useState<PaymentForm>({ ...emptyForm });

  const payments = data?.data || [];
  const totalAmount = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  // Build party suggestions from client names + unique past payment parties
  const partySuggestions = useMemo(() => {
    const clientNames = (clientsData?.data || []).map((c: any) => c.name).filter(Boolean);
    const paymentParties = [...new Set(payments.map((p: any) => p.party).filter(Boolean))];
    return [...new Set([...clientNames, ...paymentParties])];
  }, [clientsData?.data, payments]);

  // Handlers
  const handleAdd = async () => {
    if (!addForm.party.trim() || !addForm.amount || Number(addForm.amount) <= 0) {
      toast({ title: 'Validation Error', description: 'Party and a valid amount are required.', variant: 'destructive' });
      return;
    }
    try {
      await createMutation.mutateAsync({
        model: 'payment',
        data: {
          party: addForm.party.trim(),
          amount: Number(addForm.amount),
          date: addForm.date ? new Date(addForm.date).toISOString() : undefined,
          mode: addForm.mode,
          category: addForm.category.trim() || undefined,
          reference: addForm.reference.trim() || undefined,
          notes: addForm.notes.trim() || undefined,
        },
      });
      toast({ title: 'Payment Added', description: `${addForm.party} - ${formatCurrency(Number(addForm.amount))}` });
      setAddForm({ ...emptyForm });
      setAddOpen(false);
    } catch (err) {
      console.error('Failed to add payment:', err);
      toast({ title: 'Error', description: `Failed to add payment: ${err instanceof Error ? err.message : 'Unknown error'}`, variant: 'destructive' });
    }
  };

  const handleEdit = async () => {
    if (!editForm.party.trim() || !editForm.amount || Number(editForm.amount) <= 0) {
      toast({ title: 'Validation Error', description: 'Party and a valid amount are required.', variant: 'destructive' });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        model: 'payment',
        id: selectedItem.id,
        data: {
          party: editForm.party.trim(),
          amount: Number(editForm.amount),
          date: editForm.date ? new Date(editForm.date).toISOString() : undefined,
          mode: editForm.mode,
          category: editForm.category.trim() || undefined,
          reference: editForm.reference.trim() || undefined,
          notes: editForm.notes.trim() || undefined,
        },
      });
      toast({ title: 'Payment Updated', description: `${editForm.party} - ${formatCurrency(Number(editForm.amount))}` });
      setEditOpen(false);
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to update payment:', err);
      toast({ title: 'Error', description: `Failed to update payment: ${err instanceof Error ? err.message : 'Unknown error'}`, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ model: 'payment', id: selectedItem.id });
      toast({ title: 'Payment Deleted', description: `Payment from ${selectedItem.party} has been removed.` });
      setDeleteOpen(false);
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to delete payment:', err);
      toast({ title: 'Error', description: `Failed to delete payment: ${err instanceof Error ? err.message : 'Unknown error'}`, variant: 'destructive' });
    }
  };

  const openEdit = (item: any) => {
    setSelectedItem(item);
    setEditForm({
      party: item.party || '',
      amount: String(item.amount || ''),
      date: item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0],
      mode: item.mode || 'cash',
      category: item.category || '',
      reference: item.reference || '',
      notes: item.notes || '',
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
          <h2 className="text-2xl font-bold tracking-tight">Payments</h2>
          <p className="text-muted-foreground text-sm">Track all incoming payments</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2">
            <p className="text-xs text-emerald-500 font-medium">Total Received</p>
            <p className="text-lg font-bold text-emerald-500">{formatCurrency(totalAmount)}</p>
          </div>
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus className="size-4" />
            Add Payment
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search payments..."
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
        <Input
          placeholder="Filter by category..."
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPartnerFilter(''); setSiteFilter(''); }}
          className="sm:w-48"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={IndianRupee}
          title="No payments recorded"
          description="Start tracking incoming and outgoing payments to maintain accurate financial records."
          action={
            <Button onClick={() => setAddOpen(true)} size="sm">
              <Plus className="size-4" />
              Add First Payment
            </Button>
          }
        />
      ) : isMobile ? (
        /* Mobile Card View */
        <>
        <p className="text-sm font-medium text-muted-foreground">{payments.length} payment{payments.length !== 1 ? 's' : ''} · Total: {formatCurrency(totalAmount)}</p>
        <div className="space-y-3">
            {payments.map((p: any, idx: number) => (
              <Card key={p.id} className="py-0">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 shrink-0">{idx + 1}</span>
                        <p className="font-medium truncate">{p.party}</p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{formatDate(p.date)}</p>
                    </div>
                    <p className="text-lg font-bold text-emerald-500 ml-2 shrink-0">{formatCurrency(p.amount)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={modeColors[p.mode] || ''}>
                      {p.mode}
                    </Badge>
                    {p.partner && (
                      <Badge variant="secondary" className={p.partner === 'Gulshan' ? 'bg-blue-500/15 text-blue-500' : 'bg-amber-500/15 text-amber-500'}>{p.partner}</Badge>
                    )}
                    {p.category && (
                      <Badge variant="secondary">{p.category}</Badge>
                    )}
                    {p.reference && (
                      <span className="text-xs text-muted-foreground truncate">
                        Ref: {p.reference}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 pt-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(p)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => openDelete(p)}>
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
        <p className="text-sm font-medium text-muted-foreground">{payments.length} payment{payments.length !== 1 ? 's' : ''} · Total: {formatCurrency(totalAmount)}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">S.No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Party</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p: any, idx: number) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground text-xs font-mono">{idx + 1}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.date)}</TableCell>
                  <TableCell>
                    {p.partner && (
                      <Badge variant="outline" className={p.partner === 'Gulshan' ? 'bg-blue-500/15 text-blue-500 border-blue-500/20' : 'bg-amber-500/15 text-amber-500 border-amber-500/20'}>{p.partner}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{p.party}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-500">
                    {formatCurrency(p.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={modeColors[p.mode] || ''}>
                      {p.mode}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{p.notes || p.reference || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(p)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => openDelete(p)}>
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

      {/* Add Payment Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setAddForm({ ...emptyForm }); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>Record a new payment received.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="add-party">Party *</Label>
              <PartyAutocomplete
                inputId="add-party"
                value={addForm.party}
                onChange={(v) => setAddForm({ ...addForm, party: v })}
                suggestions={partySuggestions}
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
            <div className="grid gap-2">
              <Label htmlFor="add-category">Category</Label>
              <Input
                id="add-category"
                placeholder="e.g. Contract, Advance..."
                value={addForm.category}
                onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-reference">Reference</Label>
              <Input
                id="add-reference"
                placeholder="Transaction or cheque number"
                value={addForm.reference}
                onChange={(e) => setAddForm({ ...addForm, reference: e.target.value })}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setAddForm({ ...emptyForm }); }}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Add Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setSelectedItem(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>Update the payment details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-party">Party *</Label>
              <PartyAutocomplete
                inputId="edit-party"
                value={editForm.party}
                onChange={(v) => setEditForm({ ...editForm, party: v })}
                suggestions={partySuggestions}
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
            <div className="grid gap-2">
              <Label htmlFor="edit-category">Category</Label>
              <Input
                id="edit-category"
                placeholder="e.g. Contract, Advance..."
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-reference">Reference</Label>
              <Input
                id="edit-reference"
                placeholder="Transaction or cheque number"
                value={editForm.reference}
                onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setSelectedItem(null); }}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Update Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setSelectedItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the payment of {selectedItem ? formatCurrency(selectedItem.amount) : ''} from{' '}
              {selectedItem?.party || ''}? This action cannot be undone.
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
