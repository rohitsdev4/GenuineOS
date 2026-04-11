'use client';

import { useState, useMemo } from 'react';
import {
  Users, Plus, Search, Pencil, Trash2, MoreVertical, ChevronDown, ChevronRight,
  Phone, Wrench, CreditCard, BadgeCheck, Banknote, TrendingDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFetchData, useCreateData, useUpdateData, useDeleteData, useSettings } from '@/hooks/use-data';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatCurrency, statusColors, paymentModes } from '@/lib/helpers';
import { cn } from '@/lib/utils';

interface LabourWorker {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  status: string;
}

interface LabourPayment {
  id: string;
  labourId: string;
  amount: number;
  date: string;
  mode: string;
}

interface ExpenseRecord {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  paidTo: string | null;
  siteId: string | null;
  partner: string | null;
  notes: string | null;
}

const workerRoles = ['worker', 'mason', 'plumber', 'electrician', 'carpenter', 'painter', 'supervisor'];
const skillLevels = ['unskilled', 'semi-skilled', 'skilled', 'foreman'];

const emptyWorkerForm = {
  name: '', role: 'worker', phone: '', aadhaar: '', address: '', siteId: '',
  dailyWage: '0', monthlySalary: '0', bankName: '', bankAccount: '', bankIfsc: '',
  skillLevel: 'semi-skilled', joinDate: '', notes: '',
};

const emptyPaymentForm = {
  labourId: '', amount: '', date: new Date().toISOString().split('T')[0],
  month: '', daysWorked: '0', mode: 'cash', reference: '', notes: '',
};

export default function LabourTab() {
  const { toast } = useToast();
  const { data: settingsData } = useSettings();
  const settings = settingsData as Record<string, any> | undefined;
  const currency = settings?.currency || '₹';
  const dateFormat = settings?.dateFormat || 'DD/MM/YYYY';

  const [subTab, setSubTab] = useState('workers');
  const [workerSearch, setWorkerSearch] = useState('');
  const [workerStatusFilter, setWorkerStatusFilter] = useState('all');
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);

  const [addWorkerOpen, setAddWorkerOpen] = useState(false);
  const [editWorkerOpen, setEditWorkerOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<LabourWorker | null>(null);
  const [editWorkerStatus, setEditWorkerStatus] = useState('active');
  const [workerForm, setWorkerForm] = useState(emptyWorkerForm);

  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);

  // Fetch workers, labour payments, and ALL expenses (to calculate payment history from expenses)
  const { data: workersData, isLoading: workersLoading } = useFetchData({ model: 'labour', sortBy: 'createdAt', sortOrder: 'desc' });
  const { data: paymentsData, isLoading: paymentsLoading } = useFetchData({ model: 'labourPayment', sortBy: 'date', sortOrder: 'desc' });
  const { data: allExpensesData, isLoading: expensesLoading } = useFetchData({ model: 'expense', sortBy: 'date', sortOrder: 'desc', limit: 1000 });
  const { data: sitesData } = useFetchData({ model: 'site', limit: 200 });

  const createMutation = useCreateData();
  const updateMutation = useUpdateData();
  const deleteMutation = useDeleteData();

  const workers: LabourWorker[] = workersData?.data || [];
  const labourPayments: LabourPayment[] = paymentsData?.data || [];
  const allExpenses: ExpenseRecord[] = allExpensesData?.data || [];
  const sites = useMemo(() => sitesData?.data || [], [sitesData]);

  // Group expenses by paidTo (worker name) to show payment history
  const workerExpenseMap = useMemo(() => {
    const map: Record<string, ExpenseRecord[]> = {};
    allExpenses.forEach((e) => {
      if (e.paidTo && e.paidTo.trim()) {
        const key = e.paidTo.trim();
        if (!map[key]) map[key] = [];
        map[key].push(e);
      }
    });
    return map;
  }, [allExpenses]);

  // Calculate totals per worker (from both labourPayment records AND expenses where paidTo matches)
  const workerStats = useMemo(() => {
    const stats: Record<string, { totalPaid: number; paymentCount: number; lastDate: string; sites: string[] }> = {};

    workers.forEach((w) => {
      const name = w.name.trim();
      let totalPaid = 0;
      let paymentCount = 0;
      let lastDate = '';
      const siteSet = new Set<string>();

      // Sum from labourPayment records
      labourPayments.forEach((p) => {
        if (p.labourId === w.id) {
          totalPaid += p.amount || 0;
          paymentCount++;
          if (p.date && (!lastDate || new Date(p.date) > new Date(lastDate))) lastDate = p.date;
        }
      });

      // Sum from expenses where paidTo matches worker name
      const expPayments = workerExpenseMap[name] || [];
      expPayments.forEach((e) => {
        totalPaid += e.amount || 0;
        paymentCount++;
        if (e.date && (!lastDate || new Date(e.date) > new Date(lastDate))) lastDate = e.date;
        if (e.siteId) siteSet.add(e.siteId);
      });

      stats[name] = { totalPaid, paymentCount, lastDate, sites: [...siteSet] };
    });

    return stats;
  }, [workers, labourPayments, workerExpenseMap]);

  // Site name lookup
  const siteNameMap: Record<string, string> = {};
  sites.forEach((s: any) => { siteNameMap[s.id] = s.name; });

  const filteredWorkers = workers.filter((w) => {
    if (workerStatusFilter !== 'all' && w.status !== workerStatusFilter) return false;
    if (workerSearch) {
      const q = workerSearch.toLowerCase();
      return w.name.toLowerCase().includes(q) || w.role.toLowerCase().includes(q) || (w.phone && w.phone.includes(q));
    }
    return true;
  });

  const workerMap: Record<string, LabourWorker> = {};
  workers.forEach((w) => { workerMap[w.id] = w; });

  const handleAddWorker = () => {
    if (!workerForm.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    createMutation.mutate(
      {
        model: 'labour',
        data: {
          ...workerForm,
          dailyWage: parseFloat(workerForm.dailyWage) || 0,
          monthlySalary: parseFloat(workerForm.monthlySalary) || 0,
          phone: workerForm.phone || null,
          aadhaar: workerForm.aadhaar || null,
          address: workerForm.address || null,
          siteId: workerForm.siteId || undefined,
          bankName: workerForm.bankName || null,
          bankAccount: workerForm.bankAccount || null,
          bankIfsc: workerForm.bankIfsc || null,
          joinDate: workerForm.joinDate || null,
          notes: workerForm.notes || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Worker added', description: 'Worker has been added successfully.' });
          setWorkerForm(emptyWorkerForm);
          setAddWorkerOpen(false);
        },
        onError: (err: Error) => {
          toast({ title: 'Error', description: err.message, variant: 'destructive' });
        },
      }
    );
  };

  const openEditWorker = (worker: LabourWorker) => {
    setEditingWorker(worker);
    setEditWorkerStatus(worker.status);
    setWorkerForm({
      name: worker.name, role: worker.role, phone: worker.phone || '',
      aadhaar: (worker as any).aadhaar || '', address: (worker as any).address || '',
      siteId: (worker as any).siteId || '', dailyWage: (worker as any).dailyWage?.toString() || '0',
      monthlySalary: (worker as any).monthlySalary?.toString() || '0',
      bankName: (worker as any).bankName || '', bankAccount: (worker as any).bankAccount || '',
      bankIfsc: (worker as any).bankIfsc || '', skillLevel: worker.skillLevel,
      joinDate: worker.joinDate ? new Date(worker.joinDate).toISOString().split('T')[0] : '',
      notes: (worker as any).notes || '',
    });
    setEditWorkerOpen(true);
  };

  const handleUpdateWorker = () => {
    if (!editingWorker || !workerForm.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    updateMutation.mutate(
      {
        model: 'labour',
        id: editingWorker.id,
        data: {
          ...workerForm,
          status: editWorkerStatus,
          dailyWage: parseFloat(workerForm.dailyWage) || 0,
          monthlySalary: parseFloat(workerForm.monthlySalary) || 0,
          phone: workerForm.phone || null,
          aadhaar: workerForm.aadhaar || null,
          address: workerForm.address || null,
          siteId: workerForm.siteId || undefined,
          bankName: workerForm.bankName || null,
          bankAccount: workerForm.bankAccount || null,
          bankIfsc: workerForm.bankIfsc || null,
          joinDate: workerForm.joinDate || null,
          notes: workerForm.notes || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Worker updated', description: 'Worker has been updated successfully.' });
          setWorkerForm(emptyWorkerForm);
          setEditingWorker(null);
          setEditWorkerOpen(false);
        },
        onError: (err: Error) => {
          toast({ title: 'Error', description: err.message, variant: 'destructive' });
        },
      }
    );
  };

  const handleDeleteWorker = (id: string) => {
    deleteMutation.mutate(
      { model: 'labour', id },
      {
        onSuccess: () => toast({ title: 'Worker deleted', description: 'Worker has been removed.' }),
        onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const handleAddPayment = () => {
    if (!paymentForm.labourId) {
      toast({ title: 'Error', description: 'Please select a worker', variant: 'destructive' });
      return;
    }
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast({ title: 'Error', description: 'Valid amount is required', variant: 'destructive' });
      return;
    }
    createMutation.mutate(
      {
        model: 'labourPayment',
        data: {
          labourId: paymentForm.labourId,
          amount: parseFloat(paymentForm.amount),
          date: paymentForm.date || new Date().toISOString(),
          month: paymentForm.month || null,
          daysWorked: parseInt(paymentForm.daysWorked) || 0,
          mode: paymentForm.mode,
          reference: paymentForm.reference || null,
          notes: paymentForm.notes || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Payment added', description: 'Labour payment recorded successfully.' });
          setPaymentForm(emptyPaymentForm);
          setAddPaymentOpen(false);
        },
        onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const handleDeletePayment = (id: string) => {
    deleteMutation.mutate(
      { model: 'labourPayment', id },
      {
        onSuccess: () => toast({ title: 'Payment deleted', description: 'Payment record removed.' }),
        onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Labour Management</h2>
          <p className="text-sm text-muted-foreground">
            {workers.length} worker{workers.length !== 1 ? 's' : ''} · {labourPayments.length} payment{labourPayments.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="workers" className="gap-1.5">
            <Users className="size-3.5" /> Workers
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5">
            <Banknote className="size-3.5" /> Payments
          </TabsTrigger>
        </TabsList>

        {/* Workers Sub-tab */}
        <TabsContent value="workers" className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input className="pl-9 h-9" placeholder="Search workers..." value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} />
            </div>
            <Select value={workerStatusFilter} onValueChange={setWorkerStatusFilter}>
              <SelectTrigger size="sm" className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={addWorkerOpen} onOpenChange={(open) => { setAddWorkerOpen(open); if (!open) setWorkerForm(emptyWorkerForm); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add Worker</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Worker</DialogTitle>
                  <DialogDescription>Add a new worker to your labour team.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="w-name">Name *</Label>
                    <Input id="w-name" value={workerForm.name} onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })} placeholder="Full name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Role</Label>
                      <Select value={workerForm.role} onValueChange={(v) => setWorkerForm({ ...workerForm, role: v })}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {workerRoles.map((r) => (<SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Skill Level</Label>
                      <Select value={workerForm.skillLevel} onValueChange={(v) => setWorkerForm({ ...workerForm, skillLevel: v })}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {skillLevels.map((s) => (<SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="w-phone">Phone</Label>
                      <Input id="w-phone" value={workerForm.phone} onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })} placeholder="Phone number" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="w-aadhaar">Aadhaar</Label>
                      <Input id="w-aadhaar" value={workerForm.aadhaar} onChange={(e) => setWorkerForm({ ...workerForm, aadhaar: e.target.value })} placeholder="Aadhaar number" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="w-address">Address</Label>
                    <Input id="w-address" value={workerForm.address} onChange={(e) => setWorkerForm({ ...workerForm, address: e.target.value })} placeholder="Address" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Assigned Site</Label>
                    <Select value={workerForm.siteId} onValueChange={(v) => setWorkerForm({ ...workerForm, siteId: v === 'none' ? '' : v })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select site" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {sites.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="w-daily">Daily Wage</Label>
                      <Input id="w-daily" type="number" value={workerForm.dailyWage} onChange={(e) => setWorkerForm({ ...workerForm, dailyWage: e.target.value })} placeholder="0" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="w-monthly">Monthly Salary</Label>
                      <Input id="w-monthly" type="number" value={workerForm.monthlySalary} onChange={(e) => setWorkerForm({ ...workerForm, monthlySalary: e.target.value })} placeholder="0" />
                    </div>
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground font-medium">Bank Details</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="w-bank">Bank Name</Label>
                      <Input id="w-bank" value={workerForm.bankName} onChange={(e) => setWorkerForm({ ...workerForm, bankName: e.target.value })} placeholder="Bank" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="w-account">Account</Label>
                      <Input id="w-account" value={workerForm.bankAccount} onChange={(e) => setWorkerForm({ ...workerForm, bankAccount: e.target.value })} placeholder="Account no." />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="w-ifsc">IFSC</Label>
                      <Input id="w-ifsc" value={workerForm.bankIfsc} onChange={(e) => setWorkerForm({ ...workerForm, bankIfsc: e.target.value })} placeholder="IFSC code" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="w-join">Join Date</Label>
                      <Input id="w-join" type="date" value={workerForm.joinDate} onChange={(e) => setWorkerForm({ ...workerForm, joinDate: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="w-notes">Notes</Label>
                      <Input id="w-notes" value={workerForm.notes} onChange={(e) => setWorkerForm({ ...workerForm, notes: e.target.value })} placeholder="Any notes" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setAddWorkerOpen(false); setWorkerForm(emptyWorkerForm); }}>Cancel</Button>
                  <Button onClick={handleAddWorker} disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Adding...' : 'Add Worker'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-col gap-3 pr-1">
              {workersLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-4"><Skeleton className="h-5 w-1/3 mb-2" /><Skeleton className="h-4 w-2/3" /></Card>
                ))
              ) : filteredWorkers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Users className="size-10 mb-3 opacity-50" />
                  <p className="text-sm font-medium">No workers found</p>
                  <p className="text-xs mt-1">Add a worker to get started</p>
                </div>
              ) : (
                filteredWorkers.map((worker) => {
                  const stats = workerStats[worker.name] || { totalPaid: 0, paymentCount: 0, lastDate: '', sites: [] };
                  const isExpanded = expandedWorker === worker.id;
                  const workerPayments = workerExpenseMap[worker.name] || [];

                  return (
                    <Card key={worker.id} className="transition-all hover:shadow-md">
                      <CardContent className="p-4">
                        {/* Worker header row - clickable */}
                        <div
                          className="flex items-start justify-between gap-3 cursor-pointer"
                          onClick={() => setExpandedWorker(isExpanded ? null : worker.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="font-medium text-sm">{worker.name}</span>
                              <Badge variant="outline" className={cn('text-[10px] capitalize', statusColors[worker.status])}>
                                {worker.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1"><Wrench className="size-3" /> {worker.role}</span>
                              {worker.phone && <span className="flex items-center gap-1"><Phone className="size-3" /> {worker.phone}</span>}
                            </div>
                          </div>
                          {/* Right side: Total paid + expand icon */}
                          <div className="text-right shrink-0">
                            <p className="text-base font-bold text-red-500">{formatCurrency(stats.totalPaid, currency)}</p>
                            <p className="text-[10px] text-muted-foreground">{stats.paymentCount} payments</p>
                          </div>
                          <ChevronDown className={cn("size-4 text-muted-foreground shrink-0 transition-transform", isExpanded && "rotate-180")} />
                        </div>

                        {/* Expanded: Payment history */}
                        {isExpanded && (
                          <>
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingDown className="size-3.5 text-muted-foreground" />
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment History</span>
                              <span className="text-xs text-muted-foreground ml-auto">{workerPayments.length} transactions</span>
                            </div>
                            <div className="space-y-2">
                                {workerPayments.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-4">No payment records found for this worker</p>
                                ) : (
                                  workerPayments.map((exp) => (
                                    <div key={exp.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 text-xs gap-2">
                                      <div className="min-w-0 flex-1">
                                        <span className="text-muted-foreground">{formatDate(exp.date, dateFormat)}</span>
                                        {exp.category && (
                                          <Badge variant="outline" className="text-[10px] ml-1.5">{exp.category}</Badge>
                                        )}
                                        {exp.siteId && (
                                          <Badge variant="outline" className="text-[10px] ml-1.5">{siteNameMap[exp.siteId] || 'Unknown'}</Badge>
                                        )}
                                        {exp.notes && (
                                          <span className="text-muted-foreground ml-1.5 truncate max-w-[150px]">{exp.notes}</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {exp.partner && (
                                          <Badge variant="outline" className={exp.partner === 'Gulshan' ? 'bg-blue-500/15 text-blue-500 border-blue-500/20' : 'bg-amber-500/15 text-amber-500 border-amber-500/20'}>{exp.partner}</Badge>
                                        )}
                                        <span className="font-semibold text-red-500">{formatCurrency(exp.amount, currency)}</span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                          </div>
                          <div className="mt-2 pt-2 border-t flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              Sites: {stats.sites.length > 0 ? stats.sites.map(s => siteNameMap[s] || s).join(', ') : 'None'}
                            </div>
                            <div className="text-xs font-semibold text-red-500">
                              Total: {formatCurrency(stats.totalPaid, currency)}
                            </div>
                          </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
        </TabsContent>

        {/* Payments Sub-tab */}
        <TabsContent value="payments" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{filteredWorkers.length} active workers · {labourPayments.length} total payments</p>
            <Dialog open={addPaymentOpen} onOpenChange={(open) => { setAddPaymentOpen(open); if (!open) setPaymentForm(emptyPaymentForm); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add Payment</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Labour Payment</DialogTitle>
                  <DialogDescription>Record a payment made to a worker.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex flex-col gap-2">
                    <Label>Worker *</Label>
                    <Select value={paymentForm.labourId} onValueChange={(v) => setPaymentForm({ ...paymentForm, labourId: v })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select worker" /></SelectTrigger>
                      <SelectContent>
                        {workers.map((w) => (<SelectItem key={w.id} value={w.id}>{w.name} ({w.role})</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="lp-amount">Amount *</Label>
                      <Input id="lp-amount" type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder="0" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="lp-date">Date</Label>
                      <Input id="lp-date" type="date" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="lp-month">Month</Label>
                      <Input id="lp-month" value={paymentForm.month} onChange={(e) => setPaymentForm({ ...paymentForm, month: e.target.value })} placeholder="e.g. January 2025" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="lp-days">Days Worked</Label>
                      <Input id="lp-days" type="number" value={paymentForm.daysWorked} onChange={(e) => setPaymentForm({ ...paymentForm, daysWorked: e.target.value })} placeholder="0" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Payment Mode</Label>
                    <Select value={paymentForm.mode} onValueChange={(v) => setPaymentForm({ ...paymentForm, mode: v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentModes.map((m) => (<SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="lp-ref">Reference</Label>
                      <Input id="lp-ref" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} placeholder="Ref / Txn ID" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="lp-notes">Notes</Label>
                      <Input id="lp-notes" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} placeholder="Notes" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setAddPaymentOpen(false); setPaymentForm(emptyPaymentForm); }}>Cancel</Button>
                  <Button onClick={handleAddPayment} disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Adding...' : 'Add Payment'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-col gap-3 pr-1">
              {paymentsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-4"><Skeleton className="h-5 w-1/3 mb-2" /><Skeleton className="h-4 w-1/2" /></Card>
                ))
              ) : labourPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Banknote className="size-10 mb-3 opacity-50" />
                  <p className="text-sm font-medium">No payments found</p>
                  <p className="text-xs mt-1">Record a payment to get started</p>
                </div>
              ) : (
                labourPayments.map((payment) => {
                  const worker = workerMap[payment.labourId];
                  return (
                    <Card key={payment.id} className="transition-all hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="font-medium text-sm">{worker?.name || 'Unknown Worker'}</span>
                              {worker && <Badge variant="secondary" className="text-[10px] capitalize">{worker.role}</Badge>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span className="font-semibold text-foreground">{formatCurrency(payment.amount, currency)}</span>
                              <span>{formatDate(payment.date, dateFormat)}</span>
                              {payment.month && <span>{payment.month}</span>}
                              {payment.daysWorked > 0 && <span>{payment.daysWorked} day{payment.daysWorked !== 1 ? 's' : ''}</span>}
                              <Badge variant="outline" className="text-[10px]">{payment.mode}</Badge>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7 shrink-0"><MoreVertical className="size-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDeletePayment(payment.id)} className="gap-2 text-destructive focus:text-destructive">
                                <Trash2 className="size-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
        </TabsContent>
      </Tabs>

      {/* Edit Worker Dialog */}
      <Dialog open={editWorkerOpen} onOpenChange={(open) => { setEditWorkerOpen(open); if (!open) { setEditingWorker(null); setWorkerForm(emptyWorkerForm); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Worker</DialogTitle>
            <DialogDescription>Update worker details.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ew-name">Name *</Label>
              <Input id="ew-name" value={workerForm.name} onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Role</Label>
                <Select value={workerForm.role} onValueChange={(v) => setWorkerForm({ ...workerForm, role: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {workerRoles.map((r) => (<SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select value={editWorkerStatus} onValueChange={setEditWorkerStatus}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Skill Level</Label>
                <Select value={workerForm.skillLevel} onValueChange={(v) => setWorkerForm({ ...workerForm, skillLevel: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {skillLevels.map((s) => (<SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ew-phone">Phone</Label>
                <Input id="ew-phone" value={workerForm.phone} onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })} placeholder="Phone number" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Assigned Site</Label>
              <Select value={workerForm.siteId} onValueChange={(v) => setWorkerForm({ ...workerForm, siteId: v === 'none' ? '' : v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sites.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ew-daily">Daily Wage</Label>
                <Input id="ew-daily" type="number" value={workerForm.dailyWage} onChange={(e) => setWorkerForm({ ...workerForm, dailyWage: e.target.value })} placeholder="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ew-monthly">Monthly Salary</Label>
                <Input id="ew-monthly" type="number" value={workerForm.monthlySalary} onChange={(e) => setWorkerForm({ ...workerForm, monthlySalary: e.target.value })} placeholder="0" />
              </div>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground font-medium">Bank Details</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ew-bank">Bank Name</Label>
                <Input id="ew-bank" value={workerForm.bankName} onChange={(e) => setWorkerForm({ ...workerForm, bankName: e.target.value })} placeholder="Bank" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ew-account">Account</Label>
                <Input id="ew-account" value={workerForm.bankAccount} onChange={(e) => setWorkerForm({ ...workerForm, bankAccount: e.target.value })} placeholder="Account no." />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ew-ifsc">IFSC</Label>
                <Input id="ew-ifsc" value={workerForm.bankIfsc} onChange={(e) => setWorkerForm({ ...workerForm, bankIfsc: e.target.value })} placeholder="IFSC code" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ew-join">Join Date</Label>
                <Input id="ew-join" type="date" value={workerForm.joinDate} onChange={(e) => setWorkerForm({ ...workerForm, joinDate: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ew-notes">Notes</Label>
                <Input id="ew-notes" value={workerForm.notes} onChange={(e) => setWorkerForm({ ...workerForm, notes: e.target.value })} placeholder="Any notes" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditWorkerOpen(false); setEditingWorker(null); setWorkerForm(emptyWorkerForm); }}>Cancel</Button>
            <Button onClick={handleUpdateWorker} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Updating...' : 'Update Worker'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
