'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Plus, Flame, Target, TrendingUp, CheckCircle2, XCircle,
  Pencil, Trash2, ArrowLeft, Minus, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFetchData, useCreateData, useUpdateData, useDeleteData } from '@/hooks/use-data';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/empty-state';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Habit {
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

interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  completed: boolean;
  count: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  'all', 'health', 'fitness', 'productivity', 'learning',
  'mindfulness', 'finance', 'social', 'other',
] as const;

const HABIT_COLORS = [
  'emerald', 'blue', 'purple', 'amber', 'red', 'pink', 'cyan', 'slate',
] as const;

const EMOJI_OPTIONS = [
  '✅', '🏃', '💪', '📖', '🧘', '💰', '💧', '🎯',
  '🥗', '😴', '📱', '🎨', '📝', '🎵', '🌱', '☕', '⏰',
];

const COLOR_BG: Record<string, string> = {
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
  slate: 'bg-slate-500',
};

const COLOR_BG_LIGHT: Record<string, string> = {
  emerald: 'bg-emerald-500/20',
  blue: 'bg-blue-500/20',
  purple: 'bg-purple-500/20',
  amber: 'bg-amber-500/20',
  red: 'bg-red-500/20',
  pink: 'bg-pink-500/20',
  cyan: 'bg-cyan-500/20',
  slate: 'bg-slate-500/20',
};

const COLOR_TEXT: Record<string, string> = {
  emerald: 'text-emerald-500',
  blue: 'text-blue-500',
  purple: 'text-purple-500',
  amber: 'text-amber-500',
  red: 'text-red-500',
  pink: 'text-pink-500',
  cyan: 'text-cyan-500',
  slate: 'text-slate-500',
};

const COLOR_BORDER: Record<string, string> = {
  emerald: 'border-emerald-500/20',
  blue: 'border-blue-500/20',
  purple: 'border-purple-500/20',
  amber: 'border-amber-500/20',
  red: 'border-red-500/20',
  pink: 'border-pink-500/20',
  cyan: 'border-cyan-500/20',
  slate: 'border-slate-500/20',
};

const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  health: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  fitness: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  productivity: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  learning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  mindfulness: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  finance: 'bg-green-500/10 text-green-500 border-green-500/20',
  social: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  other: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyForm = {
  name: '',
  description: '',
  category: 'health',
  frequency: 'daily',
  color: 'emerald',
  icon: '✅',
  targetCount: 1,
  unit: '',
  status: 'active',
};

// ─── Streak Calculation ─────────────────────────────────────────────────────

function calculateStreak(
  logs: HabitLog[],
  habitId: string
): { current: number; best: number } {
  const habitLogs = logs.filter((l) => l.habitId === habitId && l.completed);
  if (habitLogs.length === 0) return { current: 0, best: 0 };

  const dates = [
    ...new Set(
      habitLogs.map((l) => {
        const d = new Date(l.date);
        d.setHours(0, 0, 0, 0);
        return d.toDateString();
      })
    ),
  ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Current streak – allow a 1-day gap (yesterday)
  let current = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();
  if (dates[0] === todayStr || dates[0] === yesterdayStr) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      prev.setDate(prev.getDate() - 1);
      if (prev.toDateString() === dates[i]) current++;
      else break;
    }
  }

  // Best streak
  const sortedAsc = [...dates].reverse();
  let best = 1;
  let temp = 1;
  for (let i = 1; i < sortedAsc.length; i++) {
    const prev = new Date(sortedAsc[i - 1]);
    prev.setDate(prev.getDate() + 1);
    if (prev.toDateString() === sortedAsc[i]) {
      temp++;
      best = Math.max(best, temp);
    } else {
      temp = 1;
    }
  }
  if (dates.length > 0) best = Math.max(best, temp);

  return { current, best: Math.max(current, best) };
}

// ─── Helper: get today's date string (YYYY-MM-DD) ──────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HabitsTab() {
  const { toast } = useToast();

  // Data fetching
  const { data: habitsData, isLoading } = useFetchData({
    model: 'habit',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const { data: logsData } = useFetchData({ model: 'habitLog', limit: 1000 });

  const createHabit = useCreateData();
  const updateHabit = useUpdateData();
  const deleteHabit = useDeleteData();
  const createLog = useCreateData();
  const updateLog = useUpdateData();

  // Derived data
  const habits: Habit[] = useMemo(() => habitsData?.data || [], [habitsData]);
  const logs: HabitLog[] = useMemo(() => logsData?.data || [], [logsData]);

  // State
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ─── Memoized calculations ─────────────────────────────────────────────────

  const activeHabits = useMemo(
    () => habits.filter((h) => h.status === 'active'),
    [habits]
  );

  const filteredHabits = useMemo(() => {
    if (categoryFilter === 'all') return activeHabits;
    return activeHabits.filter((h) => h.category === categoryFilter);
  }, [activeHabits, categoryFilter]);

  const today = todayStr();

  // Map of habitId -> today's log
  const todayLogs = useMemo(() => {
    const map = new Map<string, HabitLog>();
    logs.forEach((l) => {
      const logDate = dateToKey(new Date(l.date));
      if (logDate === today) {
        map.set(l.habitId, l);
      }
    });
    return map;
  }, [logs, today]);

  // Today's progress
  const todayCompleted = useMemo(() => {
    let completed = 0;
    filteredHabits.forEach((h) => {
      const log = todayLogs.get(h.id);
      if (log?.completed && log.count >= h.targetCount) completed++;
    });
    return completed;
  }, [filteredHabits, todayLogs]);

  // Best streak across all habits
  const bestStreakOverall = useMemo(() => {
    let best = 0;
    habits.forEach((h) => {
      const s = calculateStreak(logs, h.id);
      if (s.best > best) best = s.best;
    });
    return best;
  }, [habits, logs]);

  // 30-day completion rate
  const completionRate30 = useMemo(() => {
    if (habits.length === 0) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    let totalPossible = 0;
    let totalCompleted = 0;

    habits.forEach((h) => {
      if (h.status !== 'active') return;
      const created = new Date(h.createdAt);
      created.setHours(0, 0, 0, 0);
      const startDate = created > thirtyDaysAgo ? created : thirtyDaysAgo;

      const dayDiff = Math.floor(
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalPossible += dayDiff + 1;

      logs.forEach((l) => {
        if (l.habitId !== h.id || !l.completed) return;
        const logDate = new Date(l.date);
        logDate.setHours(0, 0, 0, 0);
        if (logDate >= startDate && logDate <= now) {
          totalCompleted++;
        }
      });
    });

    return totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
  }, [habits, logs]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const openAddDialog = useCallback(() => {
    setEditingHabit(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((habit: Habit) => {
    setEditingHabit(habit);
    setForm({
      name: habit.name,
      description: habit.description || '',
      category: habit.category,
      frequency: habit.frequency,
      color: habit.color,
      icon: habit.icon,
      targetCount: habit.targetCount,
      unit: habit.unit || '',
      status: habit.status,
    });
    setDialogOpen(true);
    setSelectedHabit(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Habit name is required', variant: 'destructive' });
      return;
    }
    if (editingHabit) {
      updateHabit.mutate(
        {
          model: 'habit',
          id: editingHabit.id,
          data: {
            ...form,
            description: form.description || null,
            unit: form.unit || null,
            targetCount: Number(form.targetCount) || 1,
          },
        },
        {
          onSuccess: () => {
            toast({ title: 'Habit updated', description: 'Habit has been updated successfully.' });
            setDialogOpen(false);
            setEditingHabit(null);
            setForm(emptyForm);
          },
          onError: (err: Error) => {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
          },
        }
      );
    } else {
      createHabit.mutate(
        {
          model: 'habit',
          data: {
            ...form,
            description: form.description || null,
            unit: form.unit || null,
            targetCount: Number(form.targetCount) || 1,
          },
        },
        {
          onSuccess: () => {
            toast({ title: 'Habit created', description: 'New habit added successfully.' });
            setDialogOpen(false);
            setForm(emptyForm);
          },
          onError: (err: Error) => {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
          },
        }
      );
    }
  }, [form, editingHabit, createHabit, updateHabit, toast]);

  const handleDelete = useCallback(() => {
    if (!selectedHabit) return;
    deleteHabit.mutate(
      { model: 'habit', id: selectedHabit.id },
      {
        onSuccess: () => {
          toast({ title: 'Habit deleted', description: 'Habit has been removed.' });
          setDeleteDialogOpen(false);
          setSelectedHabit(null);
        },
        onError: (err: Error) => {
          toast({ title: 'Error', description: err.message, variant: 'destructive' });
        },
      }
    );
  }, [selectedHabit, deleteHabit, toast]);

  const handleToggleToday = useCallback(
    (habit: Habit) => {
      const existing = todayLogs.get(habit.id);
      if (existing) {
        // Toggle completion
        const newCompleted = !existing.completed;
        if (newCompleted && habit.targetCount > 1) {
          // For multi-target, set count to target when checking off
          updateLog.mutate(
            {
              model: 'habitLog',
              id: existing.id,
              data: { completed: true, count: habit.targetCount },
            },
            {
              onSuccess: () => {
                toast({
                  title: newCompleted ? 'Marked complete' : 'Unchecked',
                  description: `${habit.icon} ${habit.name}`,
                });
              },
              onError: (err: Error) => {
                toast({ title: 'Error', description: err.message, variant: 'destructive' });
              },
            }
          );
        } else {
          updateLog.mutate(
            {
              model: 'habitLog',
              id: existing.id,
              data: { completed: newCompleted, count: newCompleted ? Math.max(existing.count, 1) : 0 },
            },
            {
              onSuccess: () => {
                toast({
                  title: newCompleted ? 'Marked complete' : 'Unchecked',
                  description: `${habit.icon} ${habit.name}`,
                });
              },
              onError: (err: Error) => {
                toast({ title: 'Error', description: err.message, variant: 'destructive' });
              },
            }
          );
        }
      } else {
        createLog.mutate(
          {
            model: 'habitLog',
            data: {
              habitId: habit.id,
              date: new Date().toISOString(),
              completed: true,
              count: 1,
            },
          },
          {
            onSuccess: () => {
              toast({ title: 'Marked complete', description: `${habit.icon} ${habit.name}` });
            },
            onError: (err: Error) => {
              toast({ title: 'Error', description: err.message, variant: 'destructive' });
            },
          }
        );
      }
    },
    [todayLogs, createLog, updateLog, toast]
  );

  const handleIncrementCount = useCallback(
    (habit: Habit, delta: number) => {
      const existing = todayLogs.get(habit.id);
      const newCount = Math.max(0, (existing?.count || 0) + delta);
      const completed = newCount >= habit.targetCount;

      if (existing) {
        updateLog.mutate(
          {
            model: 'habitLog',
            id: existing.id,
            data: { count: newCount, completed },
          },
          {
            onError: (err: Error) => {
              toast({ title: 'Error', description: err.message, variant: 'destructive' });
            },
          }
        );
      } else {
        createLog.mutate(
          {
            model: 'habitLog',
            data: {
              habitId: habit.id,
              date: new Date().toISOString(),
              completed,
              count: newCount,
            },
          },
          {
            onError: (err: Error) => {
              toast({ title: 'Error', description: err.message, variant: 'destructive' });
            },
          }
        );
      }
    },
    [todayLogs, createLog, updateLog, toast]
  );

  const handleTogglePastDate = useCallback(
    (habit: Habit, date: Date) => {
      const dateKey = dateToKey(date);
      const existing = logs.find((l) => {
        return l.habitId === habit.id && dateToKey(new Date(l.date)) === dateKey;
      });

      if (existing) {
        const newCompleted = !existing.completed;
        const newCount = newCompleted ? habit.targetCount : 0;
        updateLog.mutate(
          {
            model: 'habitLog',
            id: existing.id,
            data: { completed: newCompleted, count: newCount },
          },
          {
            onSuccess: () => {
              toast({
                title: newCompleted ? 'Marked complete' : 'Unchecked',
                description: `${habit.icon} ${habit.name} – ${formatDate(date, 'DD MMM YYYY')}`,
              });
            },
            onError: (err: Error) => {
              toast({ title: 'Error', description: err.message, variant: 'destructive' });
            },
          }
        );
      } else {
        createLog.mutate(
          {
            model: 'habitLog',
            data: {
              habitId: habit.id,
              date: date.toISOString(),
              completed: true,
              count: habit.targetCount,
            },
          },
          {
            onSuccess: () => {
              toast({
                title: 'Marked complete',
                description: `${habit.icon} ${habit.name} – ${formatDate(date, 'DD MMM YYYY')}`,
              });
            },
            onError: (err: Error) => {
              toast({ title: 'Error', description: err.message, variant: 'destructive' });
            },
          }
        );
      }
    },
    [logs, createLog, updateLog, toast]
  );

  // ─── Habit Detail computations ────────────────────────────────────────────

  const selectedHabitStreak = useMemo(() => {
    if (!selectedHabit) return { current: 0, best: 0 };
    return calculateStreak(logs, selectedHabit.id);
  }, [selectedHabit, logs]);

  const selectedHabitLogs = useMemo(() => {
    if (!selectedHabit) return [];
    return logs
      .filter((l) => l.habitId === selectedHabit.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedHabit, logs]);

  const selectedHabitTotalCompletions = useMemo(() => {
    if (!selectedHabit) return 0;
    return logs.filter((l) => l.habitId === selectedHabit.id && l.completed).length;
  }, [selectedHabit, logs]);

  const selectedHabitCompletionRate = useMemo(() => {
    if (!selectedHabit) return 0;
    const created = new Date(selectedHabit.createdAt);
    created.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const daysSinceCreation = Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    return daysSinceCreation > 0
      ? Math.round((selectedHabitTotalCompletions / daysSinceCreation) * 100)
      : 0;
  }, [selectedHabit, selectedHabitTotalCompletions]);

  // 30-day heatmap data for selected habit
  const heatmapData = useMemo(() => {
    if (!selectedHabit) return [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Start from 6 weeks ago (to fill ~5 rows), starting on Sunday
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 41);
    // Go back to previous Sunday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const habitLogsMap = new Map<string, HabitLog>();
    logs.forEach((l) => {
      if (l.habitId === selectedHabit.id) {
        const key = dateToKey(new Date(l.date));
        habitLogsMap.set(key, l);
      }
    });

    const cells: {
      date: Date;
      dateKey: string;
      isFuture: boolean;
      isToday: boolean;
      log: HabitLog | undefined;
    }[] = [];

    const current = new Date(startDate);
    while (current <= now) {
      const key = dateToKey(current);
      cells.push({
        date: new Date(current),
        dateKey: key,
        isFuture: false,
        isToday: key === dateToKey(now),
        log: habitLogsMap.get(key),
      });
      current.setDate(current.getDate() + 1);
    }

    return cells;
  }, [selectedHabit, logs]);

  // ─── Render ────────────────────────────────────────────────────────────────

  // Detail view
  if (selectedHabit) {
    const hc = selectedHabit.color || 'emerald';

    return (
      <div className="flex flex-col gap-4 h-full">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setSelectedHabit(null)}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedHabit.icon}</span>
              <h2 className="text-lg font-semibold truncate">{selectedHabit.name}</h2>
            </div>
            {selectedHabit.description && (
              <p className="text-sm text-muted-foreground truncate">{selectedHabit.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => openEditDialog(selectedHabit)}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 max-h-[calc(100vh-200px)]">
          <div className="flex flex-col gap-4 pr-1">
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <Card className={cn('border', COLOR_BORDER[hc])}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">Current Streak</p>
                  <div className="flex items-center gap-1.5">
                    <Flame className={cn('size-4', COLOR_TEXT[hc])} />
                    <span className="text-xl font-bold">{selectedHabitStreak.current}</span>
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                </CardContent>
              </Card>
              <Card className={cn('border', COLOR_BORDER[hc])}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">Best Streak</p>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className={cn('size-4', COLOR_TEXT[hc])} />
                    <span className="text-xl font-bold">{selectedHabitStreak.best}</span>
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                </CardContent>
              </Card>
              <Card className={cn('border', COLOR_BORDER[hc])}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">Total Completions</p>
                  <div className="flex items-center gap-1.5">
                    <Target className={cn('size-4', COLOR_TEXT[hc])} />
                    <span className="text-xl font-bold">{selectedHabitTotalCompletions}</span>
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                </CardContent>
              </Card>
              <Card className={cn('border', COLOR_BORDER[hc])}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">Completion Rate</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold">{selectedHabitCompletionRate}%</span>
                  </div>
                  <Progress value={selectedHabitCompletionRate} className="mt-1.5 h-1.5" />
                </CardContent>
              </Card>
            </div>

            {/* 30-day heatmap */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Activity</p>
                {/* Day labels */}
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {DAY_LABELS.map((d) => (
                    <div key={d} className="text-[10px] text-muted-foreground text-center mb-1">
                      {d}
                    </div>
                  ))}
                </div>
                {/* Cells */}
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {heatmapData.map((cell) => {
                    const isCompleted = cell.log?.completed && cell.log.count >= selectedHabit.targetCount;
                    const isPartial = cell.log?.completed && !isCompleted;
                    const isMissed = !cell.isFuture && !isCompleted && !isPartial && cell.dateKey < dateToKey(new Date());
                    const isPast = cell.dateKey < dateToKey(new Date());

                    let bgClass = 'bg-muted/30'; // future / empty
                    if (isCompleted) bgClass = COLOR_BG[hc];
                    else if (isPartial) bgClass = COLOR_BG_LIGHT[hc];
                    else if (isMissed && isPast) bgClass = 'bg-muted/60';

                    return (
                      <button
                        key={cell.dateKey}
                        title={`${formatDate(cell.date, 'DD MMM YYYY')}${cell.log ? (cell.log.completed ? ' ✓' : '') : ''}`}
                        className={cn(
                          'aspect-square rounded-sm transition-all hover:ring-1 hover:ring-ring/50 cursor-pointer',
                          bgClass,
                          cell.isToday && 'ring-1 ring-ring'
                        )}
                        onClick={() => handleTogglePastDate(selectedHabit, cell.date)}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-[10px] text-muted-foreground">Less</span>
                  <div className="flex gap-1">
                    <div className="size-3 rounded-sm bg-muted/30" />
                    <div className="size-3 rounded-sm bg-muted/60" />
                    <div className={cn('size-3 rounded-sm', COLOR_BG_LIGHT[hc])} />
                    <div className={cn('size-3 rounded-sm', COLOR_BG[hc])} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">More</span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Logs */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Recent Logs</p>
                {selectedHabitLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No logs yet. Click on the heatmap or check off today&apos;s habit.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedHabitLogs.slice(0, 20).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center gap-3 py-2 border-b last:border-0 border-border/50"
                      >
                        {log.completed ? (
                          <CheckCircle2 className={cn('size-4 shrink-0', COLOR_TEXT[hc])} />
                        ) : (
                          <XCircle className="size-4 shrink-0 text-muted-foreground/50" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">
                            {formatDate(log.date, 'DD MMM YYYY')}
                          </p>
                          {log.notes && (
                            <p className="text-[11px] text-muted-foreground truncate">{log.notes}</p>
                          )}
                        </div>
                        {selectedHabit.targetCount > 1 && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {log.count}/{selectedHabit.targetCount}
                            {selectedHabit.unit ? ` ${selectedHabit.unit}` : ''}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Habit</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &ldquo;{selectedHabit.name}&rdquo;? This will also
                remove all associated logs. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Main view
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Habits</h2>
          <p className="text-sm text-muted-foreground">Build better habits, track your progress</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingHabit(null);
              setForm(emptyForm);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" onClick={openAddDialog}>
              <Plus className="size-4" />
              Add Habit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingHabit ? 'Edit Habit' : 'Add Habit'}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              {/* Name */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="habit-name">Name *</Label>
                <Input
                  id="habit-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Drink Water"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="habit-desc">Description</Label>
                <Textarea
                  id="habit-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What's this habit about?"
                  rows={2}
                />
              </div>

              {/* Category + Frequency */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter((c) => c !== 'all').map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Frequency</Label>
                  <Select
                    value={form.frequency}
                    onValueChange={(v) => setForm({ ...form, frequency: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Color Picker */}
              <div className="flex flex-col gap-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {HABIT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={cn(
                        'w-8 h-8 rounded-full transition-all',
                        COLOR_BG[c],
                        form.color === c
                          ? 'ring-2 ring-offset-2 ring-offset-background ring-ring scale-110'
                          : 'hover:scale-105'
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Emoji Picker */}
              <div className="flex flex-col gap-2">
                <Label>Icon</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm({ ...form, icon: e })}
                      className={cn(
                        'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all',
                        form.icon === e
                          ? 'bg-accent ring-2 ring-primary scale-110'
                          : 'bg-muted/50 hover:bg-muted'
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Count + Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="habit-target">Target Count</Label>
                  <Input
                    id="habit-target"
                    type="number"
                    min={1}
                    value={form.targetCount}
                    onChange={(e) =>
                      setForm({ ...form, targetCount: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="habit-unit">Unit (optional)</Label>
                  <Input
                    id="habit-unit"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="e.g. cups, minutes, pages"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingHabit(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createHabit.isPending || updateHabit.isPending}
              >
                {createHabit.isPending || updateHabit.isPending
                  ? 'Saving...'
                  : editingHabit
                  ? 'Update Habit'
                  : 'Create Habit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Overview */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-6 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">Active Habits</p>
              <div className="flex items-center gap-1.5">
                <Target className="size-4 text-emerald-500" />
                <span className="text-xl font-bold">{activeHabits.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">Today&apos;s Progress</p>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-blue-500" />
                <span className="text-xl font-bold">
                  {todayCompleted}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{filteredHabits.length}
                  </span>
                </span>
              </div>
              {filteredHabits.length > 0 && (
                <Progress
                  value={Math.round((todayCompleted / filteredHabits.length) * 100)}
                  className="mt-1.5 h-1.5"
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">Best Streak</p>
              <div className="flex items-center gap-1.5">
                <Flame className="size-4 text-amber-500" />
                <span className="text-xl font-bold">{bestStreakOverall}</span>
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">Completion Rate</p>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="size-4 text-purple-500" />
                <span className="text-xl font-bold">{completionRate30}%</span>
              </div>
              <Progress value={completionRate30} className="mt-1.5 h-1.5" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={categoryFilter === cat ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 text-xs h-7"
            onClick={() => setCategoryFilter(cat)}
          >
            {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </Button>
        ))}
      </div>

      {/* Today's Habits List */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-360px)]">
        <div className="flex flex-col gap-3 pr-1">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-5 rounded" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-2/3 mb-1.5" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="size-5 rounded-md" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredHabits.length === 0 ? (
            <EmptyState
              icon={Target}
              title={
                habits.length === 0
                  ? 'No habits yet'
                  : 'No habits in this category'
              }
              description={
                habits.length === 0
                  ? 'Start building better habits by adding your first one.'
                  : 'Try selecting a different category or create a new habit.'
              }
              action={
                habits.length === 0 ? (
                  <Button size="sm" className="gap-1.5" onClick={openAddDialog}>
                    <Plus className="size-4" />
                    Add Habit
                  </Button>
                ) : undefined
              }
            />
          ) : (
            filteredHabits.map((habit) => {
              const todaysLog = todayLogs.get(habit.id);
              const isCompletedToday = todaysLog?.completed && todaysLog.count >= habit.targetCount;
              const streak = calculateStreak(logs, habit.id);
              const hc = habit.color || 'emerald';

              return (
                <Card
                  key={habit.id}
                  className={cn(
                    'transition-all hover:shadow-md',
                    isCompletedToday && COLOR_BORDER[hc],
                    isCompletedToday && 'bg-muted/30'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Checkbox / Counter */}
                      {habit.targetCount > 1 ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7"
                            onClick={() => handleIncrementCount(habit, -1)}
                            disabled={!todaysLog || todaysLog.count <= 0}
                          >
                            <Minus className="size-3" />
                          </Button>
                          <span
                            className={cn(
                              'text-sm font-semibold w-12 text-center tabular-nums',
                              isCompletedToday && COLOR_TEXT[hc]
                            )}
                          >
                            {todaysLog?.count || 0}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7"
                            onClick={() => handleIncrementCount(habit, 1)}
                            disabled={isCompletedToday}
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className={cn(
                            'size-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                            isCompletedToday
                              ? cn('border-transparent', COLOR_BG[hc])
                              : 'border-muted-foreground/30 hover:border-muted-foreground/60'
                          )}
                          onClick={() => handleToggleToday(habit)}
                          aria-label={`Toggle ${habit.name}`}
                        >
                          {isCompletedToday && (
                            <svg
                              className="size-3 text-white"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      )}

                      {/* Habit info */}
                      <button
                        className="flex-1 min-w-0 text-left"
                        onClick={() => setSelectedHabit(habit)}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-base">{habit.icon}</span>
                          <span
                            className={cn(
                              'text-sm font-medium truncate',
                              isCompletedToday && 'text-muted-foreground line-through'
                            )}
                          >
                            {habit.name}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] shrink-0',
                              CATEGORY_BADGE_CLASSES[habit.category] || CATEGORY_BADGE_CLASSES.other
                            )}
                          >
                            {habit.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {streak.current > 0 && (
                            <span className="flex items-center gap-0.5">
                              🔥 {streak.current}d
                            </span>
                          )}
                          {habit.targetCount > 1 && (
                            <span>
                              {todaysLog?.count || 0}/{habit.targetCount}
                              {habit.unit ? ` ${habit.unit}` : ''}
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Arrow to detail */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        onClick={() => setSelectedHabit(habit)}
                      >
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
