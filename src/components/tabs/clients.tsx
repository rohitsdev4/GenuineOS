'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Users, Phone, Mail, ChevronDown, TrendingUp, IndianRupee } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useFetchData, useCreateData, useUpdateData, useDeleteData } from '@/hooks/use-data';
import { statusColors, formatCurrency, formatDate } from '@/lib/helpers';
import { useToast } from '@/hooks/use-toast';

interface Client {
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

interface Transaction {
  type: 'payment' | 'receivable';
  date: string;
  amount: number;
  notes?: string;
  partner?: string;
  mode?: string;
  category?: string;
  receivedAmount?: number;
  status?: string;
  description?: string;
}

interface ClientFinancials {
  totalReceived: number;
  totalPending: number;
  paymentCount: number;
  receivableCount: number;
  transactions: Transaction[];
}

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  gstNumber: '',
  type: 'customer' as string,
};

const typeColors: Record<string, string> = {
  customer: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  supplier: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  contractor: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

const receivableStatusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  partial: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  received: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  overdue: 'bg-red-500/10 text-red-500 border-red-500/20',
  cancelled: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export default function ClientsTab() {
  const { data, isLoading } = useFetchData({ model: 'client', sortBy: 'createdAt', sortOrder: 'desc' });
  const { data: paymentsData } = useFetchData({ model: 'payment', sortBy: 'date', sortOrder: 'desc', limit: 1000 });
  const { data: receivablesData } = useFetchData({ model: 'receivable', sortBy: 'date', sortOrder: 'desc', limit: 1000 });
  const createMutation = useCreateData();
  const updateMutation = useUpdateData();
  const deleteMutation = useDeleteData();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const clients: Client[] = data?.data || data || [];

  const clientFinancials = useMemo(() => {
    const finances: Record<string, ClientFinancials> = {};

    (paymentsData?.data || []).forEach((p: any) => {
      const partyName = (p.party || '').trim();
      if (partyName) {
        if (!finances[partyName]) finances[partyName] = { totalReceived: 0, totalPending: 0, paymentCount: 0, receivableCount: 0, transactions: [] };
        finances[partyName].totalReceived += p.amount || 0;
        finances[partyName].paymentCount++;
        finances[partyName].transactions.push({
          type: 'payment',
          date: p.date,
          amount: p.amount,
          notes: p.notes,
          partner: p.partner,
          mode: p.mode,
          category: p.category,
        });
      }
    });

    (receivablesData?.data || []).forEach((r: any) => {
      const partyName = (r.party || '').trim();
      if (partyName) {
        if (!finances[partyName]) finances[partyName] = { totalReceived: 0, totalPending: 0, paymentCount: 0, receivableCount: 0, transactions: [] };
        finances[partyName].totalPending += (r.amount || 0) - (r.receivedAmount || 0);
        finances[partyName].receivableCount++;
        finances[partyName].transactions.push({
          type: 'receivable',
          date: r.dueDate,
          amount: r.amount,
          receivedAmount: r.receivedAmount,
          status: r.status,
          description: r.description,
        });
      }
    });

    // Sort transactions by date desc within each party
    Object.values(finances).forEach((f) => {
      f.transactions.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    });

    return finances;
  }, [paymentsData, receivablesData]);

  const filteredClients = useMemo(() => {
    return clients.filter((c: Client) => {
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.gstNumber?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || c.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [clients, search, typeFilter]);

  const getClientFinancials = (client: Client): ClientFinancials | null => {
    const clientName = client.name.trim().toLowerCase();
    // Try exact match first, then case-insensitive
    if (clientFinancials[client.name.trim()]) {
      return clientFinancials[client.name.trim()];
    }
    // Case-insensitive lookup
    const key = Object.keys(clientFinancials).find(
      (k) => k.trim().toLowerCase() === clientName
    );
    return key ? clientFinancials[key] : null;
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingClient(null);
  };

  const handleAdd = () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation Error', description: 'Client name is required.', variant: 'destructive' });
      return;
    }
    createMutation.mutate(
      {
        model: 'client',
        data: {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          gstNumber: form.gstNumber.trim() || undefined,
          type: form.type,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Success', description: 'Client added successfully.' });
          resetForm();
          setAddOpen(false);
        },
        onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const handleEdit = () => {
    if (!form.name.trim() || !editingClient) return;
    updateMutation.mutate(
      {
        model: 'client',
        id: editingClient.id,
        data: {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          gstNumber: form.gstNumber.trim() || undefined,
          type: form.type,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Success', description: 'Client updated successfully.' });
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
      { model: 'client', id: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: 'Success', description: 'Client deleted successfully.' });
          setDeleteTarget(null);
        },
        onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      gstNumber: client.gstNumber || '',
      type: client.type,
    });
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* ── Header: Search, Filter, Add ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filter type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="supplier">Supplier</SelectItem>
              <SelectItem value="contractor">Contractor</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="add-name">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="add-name"
                    placeholder="Client name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-phone">Phone</Label>
                  <Input
                    id="add-phone"
                    placeholder="Phone number"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-email">Email</Label>
                  <Input
                    id="add-email"
                    type="email"
                    placeholder="Email address"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-address">Address</Label>
                  <Input
                    id="add-address"
                    placeholder="Address"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-gst">GST Number</Label>
                  <Input
                    id="add-gst"
                    placeholder="GST number"
                    value={form.gstNumber}
                    onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-type">Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger id="add-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="supplier">Supplier</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setAddOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving...' : 'Add Client'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Client Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-40" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Users className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-medium">No clients found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || typeFilter !== 'all'
              ? 'Try adjusting your search or filter.'
              : 'Add your first client to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredClients.map((client: Client) => {
            const fin = getClientFinancials(client);
            const isExpanded = expandedClient === client.id;
            const totalTransactions = fin ? fin.paymentCount + fin.receivableCount : 0;

            return (
              <Card
                key={client.id}
                className={`group transition-shadow hover:shadow-md ${isExpanded ? 'md:col-span-2 xl:col-span-1 ring-1 ring-primary/20' : ''}`}
              >
                <CardContent className="p-6">
                  {/* ── Client Header ── */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-semibold">{client.name}</h3>
                      <div className="mt-2 space-y-1.5">
                        {client.phone && (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            {client.phone}
                          </p>
                        )}
                        {client.email && (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            {client.email}
                          </p>
                        )}
                        {client.gstNumber && (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="text-xs font-medium">GST:</span>
                            {client.gstNumber}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className={typeColors[client.type] || ''}>
                          {client.type}
                        </Badge>
                        <Badge variant="outline" className={statusColors[client.status] || ''}>
                          {client.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(client)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog open={!!deleteTarget?.id === client.id} onOpenChange={(v) => { if (!v) setDeleteTarget(null); else setDeleteTarget(client); }}>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Client</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{client.name}</strong>? This action cannot be undone.
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

                  {/* ── Financial Summary ── */}
                  {fin && totalTransactions > 0 && (
                    <div className="mt-4">
                      <Separator className="mb-4" />
                      <div className="grid grid-cols-2 gap-3">
                        {/* Total Received */}
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <IndianRupee className="h-3.5 w-3.5" />
                            Total Received
                          </div>
                          <p className="mt-1 text-base font-bold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(fin.totalReceived)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {fin.paymentCount} payment{fin.paymentCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {/* Pending Receivables */}
                        <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Pending
                          </div>
                          <p className="mt-1 text-base font-bold text-amber-700 dark:text-amber-400">
                            {formatCurrency(fin.totalPending)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {fin.receivableCount} receivable{fin.receivableCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {/* Expand/Collapse Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                      >
                        <ChevronDown className={`mr-1.5 h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        {totalTransactions} transaction{totalTransactions !== 1 ? 's' : ''}
                      </Button>
                    </div>
                  )}

                  {/* ── Expanded Transaction Details ── */}
                  {isExpanded && fin && fin.transactions.length > 0 && (
                    <div className="mt-2">
                      <ScrollArea className="max-h-[300px]">
                        <div className="space-y-2 pr-3">
                          {fin.transactions.map((txn, idx) => (
                            <div
                              key={idx}
                              className={`rounded-lg border p-3 text-sm ${
                                txn.type === 'payment'
                                  ? 'border-emerald-500/15 bg-emerald-500/5'
                                  : 'border-amber-500/15 bg-amber-500/5'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] px-1.5 py-0 ${
                                        txn.type === 'payment'
                                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                      }`}
                                    >
                                      {txn.type === 'payment' ? 'Payment' : 'Receivable'}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {txn.type === 'payment' ? formatDate(txn.date) : `Due: ${formatDate(txn.date)}`}
                                    </span>
                                  </div>
                                  {/* Amount */}
                                  <p className={`mt-1.5 text-base font-semibold ${
                                    txn.type === 'payment' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'
                                  }`}>
                                    {txn.type === 'payment' ? (
                                      <span className="flex items-center gap-1">
                                        <IndianRupee className="h-3.5 w-3.5" />
                                        {formatCurrency(txn.amount)}
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1">
                                          <IndianRupee className="h-3.5 w-3.5" />
                                          {formatCurrency(txn.amount)}
                                        </span>
                                        {txn.receivedAmount != null && txn.receivedAmount > 0 && (
                                          <span className="text-xs font-normal text-muted-foreground">
                                            Received: {formatCurrency(txn.receivedAmount)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </p>
                                  {/* Notes / Description */}
                                  {(txn.notes || txn.description) && (
                                    <p className="mt-1 text-xs text-muted-foreground truncate">
                                      {txn.type === 'payment' ? txn.notes : txn.description}
                                    </p>
                                  )}
                                  {/* Extra details row */}
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    {/* Payment-specific badges */}
                                    {txn.type === 'payment' && txn.partner && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50">
                                        {txn.partner}
                                      </Badge>
                                    )}
                                    {txn.type === 'payment' && txn.mode && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50 capitalize">
                                        {txn.mode}
                                      </Badge>
                                    )}
                                    {txn.type === 'payment' && txn.category && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50">
                                        {txn.category}
                                      </Badge>
                                    )}
                                    {/* Receivable-specific status badge */}
                                    {txn.type === 'receivable' && txn.status && (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] px-1.5 py-0 capitalize ${
                                          receivableStatusColors[txn.status] || 'bg-muted/50'
                                        }`}
                                      >
                                        {txn.status}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Edit Client Dialog ── */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="Client name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                placeholder="Phone number"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                placeholder="Address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-gst">GST Number</Label>
              <Input
                id="edit-gst"
                placeholder="GST number"
                value={form.gstNumber}
                onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-type">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Update Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
