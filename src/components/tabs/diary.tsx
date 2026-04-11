'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Pin, Plus, Search, FileText, Edit2, Trash2, X,
  BookOpen, Lightbulb, Heart, LayoutGrid, List,
} from 'lucide-react';
import { useFetchData, useCreateData, useUpdateData, useDeleteData } from '@/hooks/use-data';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

// ── Mood Configuration ──────────────────────────────────────────────────────
const MOODS = [
  { value: 'great', emoji: '😊', label: 'Great', ring: 'ring-green-500/30 bg-green-500/10' },
  { value: 'good', emoji: '🙂', label: 'Good', ring: 'ring-emerald-500/30 bg-emerald-500/10' },
  { value: 'okay', emoji: '😐', label: 'Okay', ring: 'ring-yellow-500/30 bg-yellow-500/10' },
  { value: 'low', emoji: '😔', label: 'Low', ring: 'ring-blue-500/30 bg-blue-500/10' },
  { value: 'bad', emoji: '😢', label: 'Bad', ring: 'ring-red-500/30 bg-red-500/10' },
  { value: 'reflective', emoji: '🤔', label: 'Reflective', ring: 'ring-violet-500/30 bg-violet-500/10' },
  { value: 'inspired', emoji: '💡', label: 'Inspired', ring: 'ring-amber-500/30 bg-amber-500/10' },
  { value: 'motivated', emoji: '🔥', label: 'Motivated', ring: 'ring-orange-500/30 bg-orange-500/10' },
] as const;

const MOOD_MAP: Record<string, (typeof MOODS)[number]> = Object.fromEntries(
  MOODS.map((m) => [m.value, m])
);

// ── Category Configuration ──────────────────────────────────────────────────
const CATEGORIES = [
  'general', 'personal', 'work', 'idea', 'important',
  'journal', 'gratitude', 'goal', 'reflection',
] as const;

const categoryBorderColors: Record<string, string> = {
  general: 'border-l-gray-400',
  personal: 'border-l-blue-400',
  work: 'border-l-emerald-400',
  idea: 'border-l-amber-400',
  important: 'border-l-red-400',
  journal: 'border-l-purple-400',
  gratitude: 'border-l-amber-300',
  goal: 'border-l-emerald-300',
  reflection: 'border-l-blue-300',
};

const categoryBadgeStyles: Record<string, string> = {
  general: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  personal: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  work: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  idea: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  important: 'bg-red-500/10 text-red-500 border-red-500/20',
  journal: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  gratitude: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  goal: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  reflection: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

// ── Note Color Configuration ────────────────────────────────────────────────
const NOTE_COLORS = ['default', 'red', 'blue', 'green', 'yellow', 'purple'] as const;

const noteColorBg: Record<string, string> = {
  default: '',
  red: 'bg-red-500/5 border-red-500/20',
  blue: 'bg-blue-500/5 border-blue-500/20',
  green: 'bg-green-500/5 border-green-500/20',
  yellow: 'bg-yellow-500/5 border-yellow-500/20',
  purple: 'bg-purple-500/5 border-purple-500/20',
};

const noteColorSwatch: Record<string, string> = {
  default: 'bg-muted',
  red: 'bg-red-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  yellow: 'bg-yellow-400',
  purple: 'bg-purple-400',
};

// ── Types ───────────────────────────────────────────────────────────────────
interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: string;
  color: string;
  mood?: string | null;
  isPinned: boolean;
  reminder: boolean;
  reminderAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  title: string;
  content: string;
  category: string;
  color: string;
  mood: string;
}

const emptyForm: FormData = {
  title: '',
  content: '',
  category: 'general',
  color: 'default',
  mood: '',
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function getWordCount(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

// ── Quick Action Config ─────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Quick Journal', category: 'journal', icon: BookOpen, color: 'text-purple-500' },
  { label: 'Quick Idea', category: 'idea', icon: Lightbulb, color: 'text-amber-500' },
  { label: 'Quick Gratitude', category: 'gratitude', icon: Heart, color: 'text-rose-500' },
] as const;

// ════════════════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════════════════
export default function DiaryTab() {
  const { toast } = useToast();

  // ── Filters & View ──
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [moodFilter, setMoodFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ── Dialog state ──
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [readingNote, setReadingNote] = useState<NoteItem | null>(null);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // ── Data ──
  const { data: notesData, isLoading } = useFetchData({
    model: 'note',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const createNote = useCreateData();
  const updateNote = useUpdateData();
  const deleteNote = useDeleteData();

  const notes: NoteItem[] = useMemo(() => {
    const all = notesData?.data || [];
    // Exclude notes used by Materials and Vehicles tabs
    return all.filter((n: any) => n.category !== 'material' && n.category !== 'vehicle');
  }, [notesData]);

  // ── Filtered notes with memo ──
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    if (categoryFilter !== 'All') {
      result = result.filter((n) => n.category === categoryFilter);
    }

    if (moodFilter !== 'All') {
      result = result.filter((n) => n.mood === moodFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q)
      );
    }

    // Pinned first, then newest
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [notes, categoryFilter, moodFilter, search]);

  // ── Form word/char counts ──
  const formWordCount = useMemo(() => getWordCount(form.content), [form.content]);
  const formCharCount = useMemo(() => form.content.length, [form.content]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setSelectedNote(null);
  }, []);

  const openAdd = useCallback((preCategory?: string) => {
    setForm({ ...emptyForm, category: preCategory || 'general' });
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((note: NoteItem) => {
    setSelectedNote(note);
    setForm({
      title: note.title,
      content: note.content,
      category: note.category,
      color: note.color || 'default',
      mood: note.mood || '',
    });
    setEditOpen(true);
  }, []);

  const openDelete = useCallback((note: NoteItem) => {
    setSelectedNote(note);
    setDeleteOpen(true);
  }, []);

  const openReading = useCallback((note: NoteItem) => {
    setReadingNote(note);
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: 'Validation Error', description: 'Title and content are required.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await createNote.mutateAsync({
        model: 'note',
        data: {
          title: form.title.trim(),
          content: form.content.trim(),
          category: form.category,
          color: form.color,
          mood: form.mood || null,
          isPinned: false,
        },
      });
      toast({ title: 'Entry created', description: 'Your journal entry has been saved.' });
      setAddOpen(false);
      setForm(emptyForm);
    } catch {
      toast({ title: 'Error', description: 'Failed to create entry.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedNote || !form.title.trim() || !form.content.trim()) {
      toast({ title: 'Validation Error', description: 'Title and content are required.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await updateNote.mutateAsync({
        model: 'note',
        id: selectedNote.id,
        data: {
          title: form.title.trim(),
          content: form.content.trim(),
          category: form.category,
          color: form.color,
          mood: form.mood || null,
        },
      });
      toast({ title: 'Entry updated', description: 'Your journal entry has been updated.' });
      setEditOpen(false);
      // Update reading view if the same note
      if (readingNote?.id === selectedNote.id) {
        setReadingNote({
          ...readingNote,
          title: form.title.trim(),
          content: form.content.trim(),
          category: form.category,
          color: form.color,
          mood: form.mood || null,
        });
      }
      resetForm();
    } catch {
      toast({ title: 'Error', description: 'Failed to update entry.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    setSubmitting(true);
    try {
      await deleteNote.mutateAsync({ model: 'note', id: selectedNote.id });
      toast({ title: 'Entry deleted', description: 'Your journal entry has been removed.' });
      setDeleteOpen(false);
      if (readingNote?.id === selectedNote.id) setReadingNote(null);
      resetForm();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete entry.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePinToggle = async (note: NoteItem) => {
    try {
      await updateNote.mutateAsync({
        model: 'note',
        id: note.id,
        data: { isPinned: !note.isPinned },
      });
      toast({
        title: note.isPinned ? 'Unpinned' : 'Pinned',
        description: `Entry has been ${note.isPinned ? 'unpinned' : 'pinned'}.`,
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to update entry.', variant: 'destructive' });
    }
  };

  // ── Mood Selector Sub-component ──────────────────────────────────────────
  const MoodSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="space-y-2">
      <Label>How are you feeling?</Label>
      <div className="flex flex-wrap gap-2">
        {MOODS.map((mood) => (
          <button
            key={mood.value}
            type="button"
            onClick={() => onChange(value === mood.value ? '' : mood.value)}
            title={mood.label}
            className={cn(
              'relative w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all',
              'hover:scale-110',
              value === mood.value
                ? `${mood.ring} ring-2`
                : 'bg-muted/50'
            )}
          >
            {mood.emoji}
          </button>
        ))}
      </div>
    </div>
  );

  // ── Color Picker Sub-component ───────────────────────────────────────────
  const ColorPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="space-y-2">
      <Label>Note Color</Label>
      <div className="flex gap-2">
        {NOTE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c.charAt(0).toUpperCase() + c.slice(1)}
            className={cn(
              'w-7 h-7 rounded-full transition-all',
              noteColorSwatch[c],
              'hover:scale-110',
              value === c
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                : 'ring-1 ring-muted-foreground/30'
            )}
          />
        ))}
      </div>
    </div>
  );

  // ── Note Form (shared for add/edit) ──────────────────────────────────────
  const NoteForm = ({ mode }: { mode: 'add' | 'edit' }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${mode}-title`}>Title *</Label>
        <Input
          id={`${mode}-title`}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Give your entry a title..."
          autoFocus
        />
      </div>

      <MoodSelector
        value={form.mood}
        onChange={(mood) => setForm({ ...form, mood })}
      />

      <div className="space-y-2">
        <Label htmlFor={`${mode}-content`}>Content *</Label>
        <Textarea
          id={`${mode}-content`}
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder="What's on your mind today? Write freely..."
          className="min-h-[200px] resize-y"
          rows={8}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formWordCount} {formWordCount === 1 ? 'word' : 'words'}</span>
          <span>{formCharCount} {formCharCount === 1 ? 'character' : 'characters'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(val) => setForm({ ...form, category: val })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <ColorPicker
            value={form.color}
            onChange={(color) => setForm({ ...form, color })}
          />
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Diary & Journal</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your personal space for thoughts, reflections & ideas
          </p>
        </div>
        <Button
          onClick={() => openAdd()}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
        >
          <Plus className="w-4 h-4" />
          New Entry
        </Button>
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.category}
            variant="outline"
            size="sm"
            onClick={() => openAdd(action.category)}
            className={cn('gap-1.5 text-xs', action.color)}
          >
            <action.icon className="w-3.5 h-3.5" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* ── Search & Filters ───────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Search row */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entries..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={moodFilter} onValueChange={(v) => setMoodFilter(v)}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="All Moods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Moods</SelectItem>
                {MOODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.emoji} {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          <Button
            variant={categoryFilter === 'All' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter('All')}
            className="h-7 text-xs"
          >
            All
          </Button>
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              className="h-7 text-xs capitalize"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Notes Display ──────────────────────────────────────────────── */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        )
      ) : filteredNotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No entries found"
          description={
            notes.length === 0
              ? 'Start capturing your thoughts and ideas with a new journal entry.'
              : 'No entries match your current search or filter.'
          }
          action={
            notes.length === 0 ? (
              <Button
                onClick={() => openAdd()}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <Plus className="w-4 h-4" />
                New Entry
              </Button>
            ) : undefined
          }
        />
      ) : (
        viewMode === 'grid' ? (
          /* ── Grid View ───────────────────────────────────────────────── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredNotes.map((note) => {
              const mood = note.mood ? MOOD_MAP[note.mood] : null;
              const wordCount = getWordCount(note.content);

              return (
                <Card
                  key={note.id}
                  className={cn(
                    'p-4 border-l-4 cursor-pointer hover:shadow-md transition-all group',
                    categoryBorderColors[note.category] || 'border-l-gray-400',
                    noteColorBg[note.color] || '',
                    note.isPinned && 'ring-1 ring-amber-500/30'
                  )}
                  onClick={() => openReading(note)}
                >
                  {/* Card top: mood + pin */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {mood && (
                        <span className="text-xl flex-shrink-0" title={mood.label}>
                          {mood.emoji}
                        </span>
                      )}
                      <h3 className="font-medium text-sm line-clamp-1 flex-1">{note.title}</h3>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePinToggle(note); }}
                      className={cn(
                        'p-1 rounded hover:bg-muted transition-colors flex-shrink-0',
                        note.isPinned ? 'text-amber-500' : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                      )}
                    >
                      <Pin className={cn('w-3.5 h-3.5', note.isPinned && 'fill-amber-500')} />
                    </button>
                  </div>

                  {/* Content preview */}
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                    {note.content.length > 120 ? note.content.substring(0, 120) + '...' : note.content}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] h-5 px-1.5 capitalize',
                        categoryBadgeStyles[note.category] || ''
                      )}
                    >
                      {note.category}
                    </Badge>
                    <div className="flex items-center gap-2">
                      {wordCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {wordCount} {wordCount === 1 ? 'word' : 'wds'}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(note.createdAt, 'relative')}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* ── List View ───────────────────────────────────────────────── */
          <div className="space-y-2">
            {filteredNotes.map((note) => {
              const mood = note.mood ? MOOD_MAP[note.mood] : null;
              const wordCount = getWordCount(note.content);

              return (
                <Card
                  key={note.id}
                  className={cn(
                    'px-4 py-3 border-l-4 cursor-pointer hover:shadow-md transition-all group',
                    categoryBorderColors[note.category] || 'border-l-gray-400',
                    noteColorBg[note.color] || '',
                    note.isPinned && 'ring-1 ring-amber-500/30'
                  )}
                  onClick={() => openReading(note)}
                >
                  <div className="flex items-center gap-3">
                    {/* Mood */}
                    {mood && (
                      <span className="text-lg flex-shrink-0" title={mood.label}>
                        {mood.emoji}
                      </span>
                    )}

                    {/* Content area */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm truncate flex-1">{note.title}</h3>
                        {note.isPinned && (
                          <Pin className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {note.content.length > 120 ? note.content.substring(0, 120) + '...' : note.content}
                      </p>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] h-5 px-1.5 capitalize hidden sm:inline-flex',
                          categoryBadgeStyles[note.category] || ''
                        )}
                      >
                        {note.category}
                      </Badge>
                      {wordCount > 0 && (
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">
                          {wordCount} wds
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(note.createdAt, 'relative')}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Full-Screen Reading Overlay                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {readingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setReadingNote(null)}
          />

          {/* Content card */}
          <Card className="relative z-10 w-full max-w-[700px] mx-4 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {readingNote.mood && MOOD_MAP[readingNote.mood] && (
                  <span className="text-2xl flex-shrink-0">
                    {MOOD_MAP[readingNote.mood].emoji}
                  </span>
                )}
                <h2 className="text-xl font-bold truncate">{readingNote.title}</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 ml-2"
                onClick={() => setReadingNote(null)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap px-6 pb-4">
              <Badge
                variant="outline"
                className={cn(
                  'text-[11px] capitalize',
                  categoryBadgeStyles[readingNote.category] || ''
                )}
              >
                {readingNote.category}
              </Badge>
              {readingNote.mood && MOOD_MAP[readingNote.mood] && (
                <Badge variant="outline" className="text-[11px]">
                  {MOOD_MAP[readingNote.mood].emoji} {MOOD_MAP[readingNote.mood].label}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {formatDate(readingNote.createdAt, 'DD MMM YYYY')}
              </span>
              <span className="text-xs text-muted-foreground">
                {getWordCount(readingNote.content)} {getWordCount(readingNote.content) === 1 ? 'word' : 'words'}
              </span>
              {readingNote.isPinned && (
                <Pin className="w-3 h-3 text-amber-500 fill-amber-500" />
              )}
            </div>

            <Separator />

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                {readingNote.content}
              </pre>
            </div>

            <Separator />

            {/* Action bar */}
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    openEdit(readingNote);
                    setReadingNote(null);
                  }}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    openDelete(readingNote);
                    setReadingNote(null);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'gap-1.5 text-xs',
                    readingNote.isPinned && 'text-amber-500'
                  )}
                  onClick={() => handlePinToggle(readingNote)}
                >
                  <Pin className={cn('w-3.5 h-3.5', readingNote.isPinned && 'fill-amber-500')} />
                  {readingNote.isPinned ? 'Unpin' : 'Pin'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs"
                  onClick={() => setReadingNote(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Add Entry Dialog                                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) setForm(emptyForm);
          setAddOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
            <DialogDescription>Capture your thoughts, ideas, or reflections.</DialogDescription>
          </DialogHeader>
          <NoteForm mode="add" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(emptyForm); setAddOpen(false); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || !form.title.trim() || !form.content.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? 'Creating...' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Edit Entry Dialog                                               */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setEditOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
            <DialogDescription>Update your journal entry details.</DialogDescription>
          </DialogHeader>
          <NoteForm mode="edit" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setEditOpen(false); }}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={submitting || !form.title.trim() || !form.content.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Delete Confirmation                                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedNote?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={submitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
