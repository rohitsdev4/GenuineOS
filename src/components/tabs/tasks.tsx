'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  CheckCircle2, Clock, AlertTriangle, XCircle, Plus, Search,
  MoreVertical, Pencil, Trash2, ChevronDown, ChevronUp,
  Calendar, Tag, User, CircleDot,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useFetchData, useCreateData, useUpdateData, useDeleteData, useSettings } from '@/hooks/use-data';
import { useToast } from '@/hooks/use-toast';
import { formatDate, taskPriorities, taskStatuses, priorityColors, statusColors } from '@/lib/helpers';
import { cn } from '@/lib/utils';

interface Task {
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
  createdAt: string;
  updatedAt: string;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <CircleDot className="size-3.5" />,
  'in-progress': <Clock className="size-3.5" />,
  completed: <CheckCircle2 className="size-3.5" />,
  cancelled: <XCircle className="size-3.5" />,
};

const emptyForm = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'pending',
  dueDate: '',
  dueTime: '',
  tags: '',
  assignee: '',
  siteId: '',
};

export default function TasksTab() {
  const { toast } = useToast();
  const { data: settingsData } = useSettings();
  const settings = settingsData as Record<string, any> | undefined;

  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useFetchData({
    model: 'task',
    sortBy: 'dueDate',
    sortOrder: 'asc',
  });
  const { data: sitesData } = useFetchData({ model: 'site', limit: 200 });
  const { data: labourData } = useFetchData({ model: 'labour', limit: 200 });

  const createMutation = useCreateData();
  const updateMutation = useUpdateData();
  const deleteMutation = useDeleteData();

  const tasks: Task[] = data?.data || [];
  const sites = useMemo(() => sitesData?.data || [], [sitesData]);
  const labourers = useMemo(() => (labourData?.data || []).map((l: any) => l.name).filter(Boolean), [labourData]);
  const currency = settings?.currency || '₹';
  const dateFormat = settings?.dateFormat || 'DD/MM/YYYY';

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        task.title.toLowerCase().includes(q) ||
        task.description?.toLowerCase().includes(q) ||
        task.tags?.toLowerCase().includes(q) ||
        task.assignee?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    return new Date(task.dueDate) < new Date();
  };

  const handleAdd = () => {
    if (!form.title.trim()) {
      toast({ title: 'Error', description: 'Title is required', variant: 'destructive' });
      return;
    }
    createMutation.mutate(
      {
        model: 'task',
        data: {
          ...form,
          siteId: form.siteId || undefined,
          tags: form.tags || null,
          assignee: form.assignee || null,
          dueDate: form.dueDate || null,
          dueTime: form.dueTime || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Task created', description: 'Task has been added successfully.' });
          setForm(emptyForm);
          setAddOpen(false);
        },
        onError: (err: Error) => {
          toast({ title: 'Error', description: err.message, variant: 'destructive' });
        },
      }
    );
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      dueTime: task.dueTime || '',
      tags: task.tags || '',
      assignee: task.assignee || '',
      siteId: (task as any).siteId || '',
    });
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editingTask || !form.title.trim()) {
      toast({ title: 'Error', description: 'Title is required', variant: 'destructive' });
      return;
    }
    updateMutation.mutate(
      {
        model: 'task',
        id: editingTask.id,
        data: {
          ...form,
          siteId: form.siteId || undefined,
          tags: form.tags || null,
          assignee: form.assignee || null,
          dueDate: form.dueDate || null,
          dueTime: form.dueTime || null,
          completedAt:
            form.status === 'completed' && editingTask.status !== 'completed'
              ? new Date().toISOString()
              : editingTask.completedAt,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Task updated', description: 'Task has been updated successfully.' });
          setForm(emptyForm);
          setEditingTask(null);
          setEditOpen(false);
        },
        onError: (err: Error) => {
          toast({ title: 'Error', description: err.message, variant: 'destructive' });
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { model: 'task', id },
      {
        onSuccess: () => {
          toast({ title: 'Task deleted', description: 'Task has been removed.' });
        },
        onError: (err: Error) => {
          toast({ title: 'Error', description: err.message, variant: 'destructive' });
        },
      }
    );
  };

  const handleQuickStatus = (task: Task, newStatus: string) => {
    updateMutation.mutate(
      {
        model: 'task',
        id: task.id,
        data: {
          status: newStatus,
          completedAt:
            newStatus === 'completed' && task.status !== 'completed'
              ? new Date().toISOString()
              : task.completedAt,
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Status updated', description: `Task marked as ${newStatus}.` });
        },
        onError: (err: Error) => {
          toast({ title: 'Error', description: err.message, variant: 'destructive' });
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tasks</h2>
          <p className="text-sm text-muted-foreground">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Task</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="add-title">Title *</Label>
                <Input
                  id="add-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Task title"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="add-desc">Description</Label>
                <Textarea
                  id="add-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Task description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {taskPriorities.map((p) => (
                        <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {taskStatuses.map((s) => (
                        <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-date">Due Date</Label>
                  <Input id="add-date" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-time">Due Time</Label>
                  <Input id="add-time" type="time" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Site</Label>
                  <Select value={form.siteId} onValueChange={(v) => setForm({ ...form, siteId: v === 'none' ? '' : v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select site" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {sites.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-tags">Tags (comma separated)</Label>
                  <Input id="add-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g. urgent, site-a, follow-up" />
                </div>
              </div>
              <div className="flex flex-col gap-2 relative">
                <Label htmlFor="add-assignee">Assignee</Label>
                <Input id="add-assignee" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} placeholder="Assign to..." />
                {form.assignee && labourers.filter(l => l.toLowerCase().includes(form.assignee.toLowerCase()) && l.toLowerCase() !== form.assignee.toLowerCase()).length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {labourers
                      .filter(l => l.toLowerCase().includes(form.assignee.toLowerCase()) && l.toLowerCase() !== form.assignee.toLowerCase())
                      .slice(0, 6)
                      .map((l) => (
                        <div
                          key={l}
                          className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
                          onMouseDown={() => setForm({ ...form, assignee: l })}
                        >
                          {l}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setAddOpen(false); setForm(emptyForm); }}>Cancel</Button>
              <Button onClick={handleAdd} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Task'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger size="sm" className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {taskStatuses.map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger size="sm" className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {taskPriorities.map((p) => (
                <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task List */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-280px)]">
        <div className="flex flex-col gap-3 pr-1">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </Card>
            ))
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckCircle2 className="size-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">No tasks found</p>
              <p className="text-xs mt-1">
                {search || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create a new task to get started'}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const overdue = isOverdue(task);
              const expanded = expandedId === task.id;
              const tags = task.tags ? task.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

              return (
                <Card
                  key={task.id}
                  className={cn('transition-all hover:shadow-md cursor-pointer', overdue && 'border-red-500/50 bg-red-500/5')}
                  onClick={() => setExpandedId(expanded ? null : task.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={cn('font-medium text-sm truncate', task.status === 'completed' && 'line-through text-muted-foreground')}>
                            {task.title}
                          </span>
                          {overdue && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] gap-1 shrink-0">
                              <AlertTriangle className="size-3" /> Overdue
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground truncate mb-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={cn('text-[10px] gap-1', priorityColors[task.priority])}>
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </Badge>
                          <Badge variant="outline" className={cn('text-[10px] gap-1', statusColors[task.status])}>
                            {statusIcons[task.status]}
                            {task.status.charAt(0).toUpperCase() + task.status.slice(1).replace('-', ' ')}
                          </Badge>
                          {task.dueDate && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="size-3" /> {formatDate(task.dueDate, dateFormat)}
                            </span>
                          )}
                          {task.assignee && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <User className="size-3" /> {task.assignee}
                            </span>
                          )}
                          {tags.length > 0 && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Tag className="size-3" /> {tags.slice(0, 2).join(', ')}{tags.length > 2 && ` +${tags.length - 2}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="size-7"><CircleDot className="size-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {taskStatuses.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={(e) => { e.stopPropagation(); handleQuickStatus(task, s); }}
                                className={cn('gap-2', task.status === s && 'bg-accent')}
                              >
                                {statusIcons[s]}
                                {s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="size-7"><MoreVertical className="size-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(task); }} className="gap-2">
                              <Pencil className="size-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="gap-2 text-destructive focus:text-destructive">
                              <Trash2 className="size-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="ghost" size="icon" className="size-7" onClick={(e) => { e.stopPropagation(); setExpandedId(expanded ? null : task.id); }}>
                          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </Button>
                      </div>
                    </div>

                    {expanded && (
                      <>
                        <Separator className="my-3" />
                        <div className="text-xs space-y-2">
                          {task.description && (
                            <div>
                              <span className="text-muted-foreground font-medium">Description</span>
                              <p className="mt-0.5 whitespace-pre-wrap">{task.description}</p>
                            </div>
                          )}
                          {task.dueDate && (
                            <div className="flex gap-4">
                              <div>
                                <span className="text-muted-foreground font-medium">Due Date</span>
                                <p className="mt-0.5">{formatDate(task.dueDate, dateFormat)}</p>
                              </div>
                              {task.dueTime && (
                                <div>
                                  <span className="text-muted-foreground font-medium">Due Time</span>
                                  <p className="mt-0.5">{task.dueTime}</p>
                                </div>
                              )}
                            </div>
                          )}
                          {task.assignee && (
                            <div>
                              <span className="text-muted-foreground font-medium">Assignee</span>
                              <p className="mt-0.5">{task.assignee}</p>
                            </div>
                          )}
                          {tags.length > 0 && (
                            <div>
                              <span className="text-muted-foreground font-medium">Tags</span>
                              <div className="flex gap-1.5 flex-wrap mt-1">
                                {tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="text-muted-foreground pt-1">
                            Created {formatDate(task.createdAt, dateFormat)}
                            {task.updatedAt !== task.createdAt && ` · Updated ${formatDate(task.updatedAt, dateFormat)}`}
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
      </ScrollArea>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { setEditingTask(null); setForm(emptyForm); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input id="edit-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Task description" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {taskPriorities.map((p) => (
                      <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {taskStatuses.map((s) => (
                      <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-date">Due Date</Label>
                <Input id="edit-date" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-time">Due Time</Label>
                <Input id="edit-time" type="time" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Site</Label>
                <Select value={form.siteId} onValueChange={(v) => setForm({ ...form, siteId: v === 'none' ? '' : v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {sites.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-tags">Tags (comma separated)</Label>
                <Input id="edit-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g. urgent, site-a, follow-up" />
              </div>
            </div>
            <div className="flex flex-col gap-2 relative">
              <Label htmlFor="edit-assignee">Assignee</Label>
              <Input id="edit-assignee" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} placeholder="Assign to..." />
              {form.assignee && labourers.filter(l => l.toLowerCase().includes(form.assignee.toLowerCase()) && l.toLowerCase() !== form.assignee.toLowerCase()).length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {labourers
                    .filter(l => l.toLowerCase().includes(form.assignee.toLowerCase()) && l.toLowerCase() !== form.assignee.toLowerCase())
                    .slice(0, 6)
                    .map((l) => (
                      <div
                        key={l}
                        className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
                        onMouseDown={() => setForm({ ...form, assignee: l })}
                      >
                        {l}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setEditingTask(null); setForm(emptyForm); }}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Updating...' : 'Update Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
