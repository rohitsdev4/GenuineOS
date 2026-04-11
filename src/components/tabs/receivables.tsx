'use client';

import { useState, useMemo } from 'react';
import {
  HandCoins, Plus, Pencil, Trash2, Loader2, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import { useFetchData, useCreateData, useUpdateData, useDeleteData } from '@/hooks/use-data';
import { useToast } from '@/hooks/use-toast';
import { priorityColors, statusColors, formatCurrency, formatDate } from '@/lib/helpers';

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
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';

const priorities = ['low', 'medium', 'high', 'urgent'];
const statuses = ['pending', 'partial', 'received', 'overdue'];

interface AddReceivableForm {
  party: string;
  amount: string;
  dueDate: string;
  description: string;
  priority: string;
  notes: string;
  clientId: string;
}

interface UpdateReceivableForm {
  receivedAmount: string;
  status: string;
  notes: string;
}

const emptyAddForm: AddReceivableForm = {
  party: '',
  amount: '',
  dueDate: '',
  description: '',
  priority: 'medium',
  notes: '',
  clientId: '',
};

const emptyUpdateForm: UpdateReceivableForm = {
  receivedAmount: '',
  status: 'pending',
  notes: '',
};

export default function ReceivablesTab() {
  const { toast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Data fetching - filter on client side since API filterField only supports one field at a time
  const { data, isLoading } = useFetchData({
    model: 'receivable',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const { data: clientsData } = useFetchData({ model: 'client', limit: 200 });

  const createMutation = useCreateData();
  const updateMutation = useUpdateData();
  const deleteMutation = useDeleteData();

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Forms
  const [addForm, setAddForm] = useState<AddReceivableForm>({ ...emptyAddForm });
  const [updateForm, setUpdateForm] = useState<UpdateReceivableForm>({ ...emptyUpdateForm });

  const allReceivables = data?.data || [];
  const clients = clientsData?.data || [];
  const partySuggestions = useMemo(() => {
    const clientNames = clients.map((c: any) => c.name);
    const pastParties = allReceivables.map((r: any) => r.party).filter(Boolean);
    return [...new Set([...clientNames, ...pastParties])];
  }, [clients, allReceivables]);

  const receivables = useMemo(() => {
    let filtered = [...allReceivables];
    if (statusFilter !== 'all') {
      filtered = filtered.filter((r: any) => r.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((r: any) => r.priority === priorityFilter);
    }
    return filtered;
  }, [allReceivables, statusFilter, priorityFilter]);

  // Summary calculations
  const summary = useMemo(() => {
    const total = allReceivables.reduce((s: number, r: any) => s + (r.amount || 0), 0);
    const received = allReceivables.reduce((s: number, r: any) => s + (r.receivedAmount || 0), 0);
    const pending = total - received;
    return { total, received, pending };
  }, [allReceivables]);

  // Check if item is overdue
  const isOverdue = (item: any) => {
    if (!item.dueDate) return false;
    const dueDate = new Date(item.dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < now && (item.status === 'pending' || item.status === 'partial');
  };

  const handleAdd = async () => {
    if (!addForm.party.trim() || !addForm.amount || Number(addForm.amount) <= 0) {
      toast({ title: 'Validation Error', description: 'Party and a valid amount are required.', variant: 'destructive' });
      return;
    }
    try {
      await createMutation.mutateAsync({
        model: 'receivable',
        data: {
          party: addForm.party.trim(),
          amount: Number(addForm.amount),
          clientId: addForm.clientId || undefined,
          dueDate: addForm.dueDate ? new Date(addForm.dueDate).toISOString() : undefined,
          description: addForm.description.trim() || undefined,
          priority: addForm.priority,
          notes: addForm.notes.trim() || undefined,
        },
      });
      toast({ title: 'Receivable Added', description: `${addForm.party} - ${formatCurrency(Number(addForm.amount))}` });
      setAddForm({ ...emptyAddForm });
      setAddOpen(false);
    } catch (err) {
      console.error('Failed to add receivable:', err);
      toast({ title: 'Error', description: `Failed to add receivable: ${err instanceof Error ? err.message : 'Unknown error'}`, variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    if (!updateForm.status) {
      toast({ title: 'Validation Error', description: 'Status is required.', variant: 'destructive' });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        model: 'receivable',
        id: selectedItem.id,
        data: {
          receivedAmount: Number(updateForm.receivedAmount) || 0,
          status: updateForm.status,
          notes: updateForm.notes.trim() || undefined,
        },
      });
      toast({ title: 'Receivable Updated', description: `Status updated to ${updateForm.status}.` });
      setUpdateOpen(false);
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to update receivable:', err);
      toast({ title: 'Error', description: `Failed to update receivable: ${err instanceof Error ? err.message : 'Unknown error'}`, variant: 'destructive' });
    }
  };

  const handleMarkFullyReceived = () => {
    if (!selectedItem) return;
    setUpdateForm({
      receivedAmount: String(selectedItem.amount),
      status: 'received',
      notes: updateForm.notes,
    });
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ model: 'receivable', id: selectedItem.id });
      toast({ title: 'Receivable Deleted', description: `Receivable from ${selectedItem.party} has been removed.` });
      setDeleteOpen(false);
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to delete receivable:', err);
      toast({ title: 'Error', description: `Failed to delete receivable: ${err instanceof Error ? err.message : 'Unknown error'}`, variant: 'destructive' });
    }
  };

  const openUpdate = (item: any) => {
    setSelectedItem(item);
    setUpdateForm({
      receivedAmount: String(item.receivedAmount || 0),
      status: item.status || 'pending',
      notes: item.notes || '',
    });
    setUpdateOpen(true);
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
          <h2 className="text-2xl font-bold tracking-tight">Receivables</h2>
          <p className="text-muted-foreground text-sm">Manage outstanding payments from clients</p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="size-4" />
          Add Receivable
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="py-4">
          <CardContent className="px-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Clock className="size-3" />
              Total Pending
            </p>
            <p className="text-xl font-bold text-amber-500">{formatCurrency(summary.pending)}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <HandCoins className="size-3" />
              Total Amount
            </p>
            <p className="text-xl font-bold">{formatCurrency(summary.total)}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <CheckCircle2 className="size-3" />
              Received Amount
            </p>
            <p className="text-xl font-bold text-emerald-500">{formatCurrency(summary.received)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="All Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {priorities.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : receivables.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No receivables"
          description="Manage outstanding payments and track what clients owe you for completed work."
          action={
            <Button onClick={() => setAddOpen(true)} size="sm">
              <Plus className="size-4" />
              Add First Receivable
            </Button>
          }
        />
      ) : (
        <ScrollArea className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-3">{receivables.length} receivable{receivables.length !== 1 ? 's' : ''} · Pending: {formatCurrency(summary.pending)}</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {receivables.map((r: any) => {
              const overdue = isOverdue(r);
              const progressPercent = r.amount > 0 ? Math.min(100, Math.round(((r.receivedAmount || 0) / r.amount) * 100)) : 0;
              return (
                <Card
                  key={r.id}
                  className={`py-0 transition-all ${overdue ? 'border-red-500/50 bg-red-500/5' : ''}`}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{r.party}</p>
                          {overdue && (
                            <AlertTriangle className="size-3.5 text-red-500 shrink-0" />
                          )}
                        </div>
                        {r.description && (
                          <p className="text-sm text-muted-foreground truncate">{r.description}</p>
                        )}
                      </div>
                      <p className="text-lg font-bold shrink-0">{formatCurrency(r.amount)}</p>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={statusColors[r.status] || statusColors.pending}>
                        {r.status}
                      </Badge>
                      <Badge variant="outline" className={priorityColors[r.priority] || priorityColors.medium}>
                        {r.priority}
                      </Badge>
                    </div>

                    {/* Due Date */}
                    {r.dueDate && (
                      <p className="text-xs text-muted-foreground">
                        Due: {formatDate(r.dueDate)}
                        {overdue && (
                          <span className="text-red-500 font-medium ml-1">(Overdue)</span>
                        )}
                      </p>
                    )}

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {formatCurrency(r.receivedAmount || 0)} received
                        </span>
                        <span className="text-muted-foreground">{progressPercent}%</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1 pt-1">
                      <Button variant="ghost" size="sm" className="size-8" onClick={() => openUpdate(r)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="size-8 text-destructive" onClick={() => openDelete(r)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Add Receivable Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setAddForm({ ...emptyAddForm }); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Receivable</DialogTitle>
            <DialogDescription>Add a new outstanding payment to track.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2 relative">
              <Label htmlFor="add-party">Party *</Label>
              <Input
                id="add-party"
                placeholder="Client or party name"
                value={addForm.party}
                onChange={(e) => setAddForm({ ...addForm, party: e.target.value })}
              />
              {addForm.party && partySuggestions.filter(p => p.toLowerCase().includes(addForm.party.toLowerCase()) && p.toLowerCase() !== addForm.party.toLowerCase()).length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {partySuggestions
                    .filter(p => p.toLowerCase().includes(addForm.party.toLowerCase()) && p.toLowerCase() !== addForm.party.toLowerCase())
                    .slice(0, 6)
                    .map((p) => (
                      <div
                        key={p}
                        className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
                        onMouseDown={() => setAddForm({ ...addForm, party: p })}
                      >
                        {p}
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Client</Label>
              <Select value={addForm.clientId} onValueChange={(v) => setAddForm({ ...addForm, clientId: v === 'none' ? '' : v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {clients.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
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
                <Label htmlFor="add-dueDate">Due Date</Label>
                <Input
                  id="add-dueDate"
                  type="date"
                  value={addForm.dueDate}
                  onChange={(e) => setAddForm({ ...addForm, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-description">Description</Label>
              <Input
                id="add-description"
                placeholder="Brief description of the receivable"
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-priority">Priority</Label>
              <Select value={addForm.priority} onValueChange={(v) => setAddForm({ ...addForm, priority: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button variant="outline" onClick={() => { setAddOpen(false); setAddForm({ ...emptyAddForm }); }}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Add Receivable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Receivable Dialog */}
      <Dialog open={updateOpen} onOpenChange={(open) => { setUpdateOpen(open); if (!open) setSelectedItem(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Receivable</DialogTitle>
            <DialogDescription>
              Update payment status for {selectedItem?.party || ''} — {selectedItem ? formatCurrency(selectedItem.amount) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="update-received">Received Amount</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="update-received"
                  type="number"
                  placeholder="0"
                  min="0"
                  max={selectedItem?.amount || 999999999}
                  value={updateForm.receivedAmount}
                  onChange={(e) => setUpdateForm({ ...updateForm, receivedAmount: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 whitespace-nowrap"
                  onClick={handleMarkFullyReceived}
                >
                  <CheckCircle2 className="size-3.5" />
                  Mark Fully Received
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="update-status">Status</Label>
              <Select value={updateForm.status} onValueChange={(v) => setUpdateForm({ ...updateForm, status: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="update-notes">Notes</Label>
              <Textarea
                id="update-notes"
                placeholder="Add follow-up notes..."
                value={updateForm.notes}
                onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUpdateOpen(false); setSelectedItem(null); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Update Receivable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setSelectedItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Receivable</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the receivable of {selectedItem ? formatCurrency(selectedItem.amount) : ''} from{' '}
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
