'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Palette, Building2, Bot, Bell, Sheet, Moon, Sun, Check, Save, RefreshCw,
  Eye, EyeOff, Users, Plus, Pencil, Trash2, Loader2, Brain, Clock,
  Shield, Zap, AlertCircle, Settings, CopyX,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useSettings, useFetchData, useCreateData, useUpdateData, useDeleteData, useSheetsSync,
} from '@/hooks/use-data';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/stores/app-store';
import { formatDate } from '@/lib/helpers';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────────────────

const accentColors = [
  { name: 'emerald', class: 'bg-emerald-500' },
  { name: 'blue', class: 'bg-blue-500' },
  { name: 'purple', class: 'bg-purple-500' },
  { name: 'orange', class: 'bg-orange-500' },
  { name: 'red', class: 'bg-red-500' },
  { name: 'teal', class: 'bg-teal-500' },
  { name: 'cyan', class: 'bg-cyan-500' },
  { name: 'pink', class: 'bg-pink-500' },
];

const currencies = ['₹', '$', '€', '£'];
const llmProviders = ['gemini'];
const geminiModels = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
  { value: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash Preview (Thinking)' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (Fast)' },
];
const syncIntervals = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '60 minutes', value: 60 },
  { label: '120 minutes', value: 120 },
];

const managerRoles = ['manager', 'accountant', 'admin'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Manager {
  id: string;
  name: string;
  phone?: string | null;
  role: string;
  status: string;
  notes?: string | null;
  createdAt?: string;
}

interface ManagerForm {
  name: string;
  phone: string;
  role: string;
  notes: string;
}

const emptyManagerForm: ManagerForm = { name: '', phone: '', role: 'manager', notes: '' };

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsTab() {
  const { toast } = useToast();
  const { data: settings, updateSettings, isUpdating } = useSettings();
  const { data: managersData, isLoading: managersLoading } = useFetchData({ model: 'manager' });
  const createManager = useCreateData();
  const updateManager = useUpdateData();
  const deleteManager = useDeleteData();
  const { syncSheets, isSyncing, lastSyncResult } = useSheetsSync();
  const thinkingEnabled = useAppStore((s) => s.thinkingEnabled);
  const setThinkingEnabled = useAppStore((s) => s.setThinkingEnabled);

  const s = settings as Record<string, any> | undefined;

  // ── Local form state ────────────────────────────────────────────────────────

  const [profile, setProfile] = useState({
    businessName: '', businessPhone: '', businessAddress: '',
    businessEmail: '', businessGst: '',
  });
  const [llm, setLlm] = useState({
    apiKey: '', modelName: 'gemini-2.5-flash', provider: 'gemini',
    temperature: 0.7, maxTokens: 8192,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [sheets, setSheets] = useState({ sheetId: '', apiKey: '' });
  const [showSheetKey, setShowSheetKey] = useState(false);
  const [appearance, setAppearance] = useState({
    theme: 'dark', accentColor: 'emerald', currency: '₹',
  });

  // Manager form state
  const [managerForm, setManagerForm] = useState<ManagerForm>({ ...emptyManagerForm });
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);

  // ── Sync server settings → local state (once per load) ──────────────────────

  const [syncedId, setSyncedId] = useState<string | null>(null);

  // Derived state sync: only update local form when server settings ID changes
  useEffect(() => {
    if (s && s.id && s.id !== syncedId) {
      setSyncedId(s.id);
      setProfile({
        businessName: s.businessName || '',
        businessPhone: s.businessPhone || '',
        businessAddress: s.businessAddress || '',
        businessEmail: s.businessEmail || '',
        businessGst: s.businessGst || '',
      });
      setLlm({
        apiKey: s.apiKey || '',
        modelName: s.model || 'gemini-2.5-flash',
        provider: s.llmProvider || 'gemini',
        temperature: s.temperature ?? 0.7,
        maxTokens: s.maxTokens ?? 8192,
      });
      setSheets({ sheetId: s.googleSheetId || '', apiKey: s.googleApiKey || '' });
      setAppearance({
        theme: s.theme || 'dark',
        accentColor: s.accentColor || 'emerald',
        currency: s.currency || '₹',
      });
    }
  }, [s, syncedId]);

  // ── Toast helper ────────────────────────────────────────────────────────────

  const showToast = useCallback((title: string, description?: string, variant?: 'default' | 'destructive') => {
    toast({ title, description, variant });
  }, [toast]);

  // ── Auto-sync effect ────────────────────────────────────────────────────────

  useEffect(() => {
    if (s?.autoSync && s?.googleSheetConnected) {
      const interval = (s.syncInterval || 60) * 60 * 1000;
      const timer = setInterval(() => syncSheets('sync'), interval);
      return () => clearInterval(timer);
    }
  }, [s?.autoSync, s?.googleSheetConnected, s?.syncInterval, syncSheets]);

  // ── Show sync result toast ──────────────────────────────────────────────────

  useEffect(() => {
    if (lastSyncResult) {
      showToast('Sync Result', lastSyncResult);
    }
  }, [lastSyncResult, showToast]);

  // ── Profile save ────────────────────────────────────────────────────────────

  const saveProfile = useCallback(() => {
    updateSettings({
      businessName: profile.businessName,
      businessPhone: profile.businessPhone,
      businessAddress: profile.businessAddress,
      businessEmail: profile.businessEmail,
      businessGst: profile.businessGst,
    }).then(() => {
      showToast('Saved', 'Business profile updated successfully.');
    }).catch(() => {
      showToast('Error', 'Failed to save profile.', 'destructive');
    });
  }, [profile, updateSettings, showToast]);

  // ── LLM save ────────────────────────────────────────────────────────────────

  const saveLlm = useCallback(() => {
    updateSettings({
      llmProvider: llm.provider,
      model: llm.modelName,
      apiKey: llm.apiKey,
      temperature: llm.temperature,
      maxTokens: llm.maxTokens,
      thinkingEnabled,
    }).then(() => {
      showToast('Saved', 'LLM configuration updated.');
    }).catch(() => {
      showToast('Error', 'Failed to save LLM config.', 'destructive');
    });
  }, [llm, thinkingEnabled, updateSettings, showToast]);

  // ── Appearance save ─────────────────────────────────────────────────────────

  const saveAppearance = useCallback(() => {
    updateSettings({
      theme: appearance.theme,
      accentColor: appearance.accentColor,
      currency: appearance.currency,
    }).then(() => {
      showToast('Saved', 'Appearance settings updated.');
    }).catch(() => {
      showToast('Error', 'Failed to save appearance.', 'destructive');
    });
  }, [appearance, updateSettings, showToast]);

  // ── Theme toggle ────────────────────────────────────────────────────────────

  const handleThemeToggle = useCallback((newTheme: string) => {
    setAppearance((p) => ({ ...p, theme: newTheme }));
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // ── Notification toggle (immediate save) ────────────────────────────────────

  const toggleNotification = useCallback((field: string, value: boolean) => {
    updateSettings({ [field]: value }).then(() => {
      showToast('Updated', `${field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())} ${value ? 'enabled' : 'disabled'}.`);
    }).catch(() => {
      showToast('Error', 'Failed to update.', 'destructive');
    });
  }, [updateSettings, showToast]);

  // ── Google Sheets actions ───────────────────────────────────────────────────

  const saveAndConnectSheets = useCallback(async () => {
    try {
      await updateSettings({
        googleSheetId: sheets.sheetId,
        googleApiKey: sheets.apiKey,
      });
      await syncSheets('connect', sheets.sheetId, sheets.apiKey);
      showToast('Connected', 'Google Sheets connected successfully.');
    } catch {
      showToast('Error', 'Failed to connect Google Sheets.', 'destructive');
    }
  }, [sheets, updateSettings, syncSheets, showToast]);

  const testConnection = useCallback(async () => {
    try {
      const result = await syncSheets('test');
      if (result.success) {
        showToast('Success', 'Connection test passed.');
      } else {
        showToast('Failed', result.error || 'Connection test failed.', 'destructive');
      }
    } catch {
      showToast('Error', 'Connection test failed.', 'destructive');
    }
  }, [syncSheets, showToast]);

  const syncDataNow = useCallback(async () => {
    try {
      const result = await syncSheets('sync');
      if (result.success) {
        showToast('Synced', 'Data synced from Google Sheets.');
      } else {
        showToast('Error', result.error || 'Sync failed.', 'destructive');
      }
    } catch {
      showToast('Error', 'Sync failed.', 'destructive');
    }
  }, [syncSheets, showToast]);

  const toggleAutoSync = useCallback(() => {
    const newVal = !(s?.autoSync ?? false);
    updateSettings({ autoSync: newVal }).then(() => {
      showToast('Updated', `Auto sync ${newVal ? 'enabled' : 'disabled'}.`);
    }).catch(() => {
      showToast('Error', 'Failed to update auto sync.', 'destructive');
    });
  }, [s?.autoSync, updateSettings, showToast]);

  const handleSyncIntervalChange = useCallback((value: string) => {
    updateSettings({ syncInterval: parseInt(value) }).then(() => {
      showToast('Updated', 'Sync interval changed.');
    }).catch(() => {
      showToast('Error', 'Failed to update sync interval.', 'destructive');
    });
  }, [updateSettings, showToast]);

  // ── Manager CRUD ────────────────────────────────────────────────────────────

  const managers: Manager[] = useMemo(() => {
    if (!managersData) return [];
    if (Array.isArray(managersData)) return managersData;
    if (managersData.data && Array.isArray(managersData.data)) return managersData.data;
    return [];
  }, [managersData]);

  const openAddManager = useCallback(() => {
    setManagerForm({ ...emptyManagerForm });
    setEditingManagerId(null);
    setManagerDialogOpen(true);
  }, []);

  const openEditManager = useCallback((m: Manager) => {
    setManagerForm({ name: m.name, phone: m.phone || '', role: m.role, notes: m.notes || '' });
    setEditingManagerId(m.id);
    setManagerDialogOpen(true);
  }, []);

  const handleSaveManager = useCallback(() => {
    if (!managerForm.name.trim()) {
      showToast('Error', 'Manager name is required.', 'destructive');
      return;
    }
    const payload = {
      name: managerForm.name.trim(),
      phone: managerForm.phone.trim() || undefined,
      role: managerForm.role,
      notes: managerForm.notes.trim() || undefined,
    };
    if (editingManagerId) {
      updateManager.mutate(
        { model: 'manager', id: editingManagerId, data: payload },
        {
          onSuccess: () => {
            showToast('Updated', 'Manager updated.');
            setManagerDialogOpen(false);
          },
          onError: () => showToast('Error', 'Failed to update manager.', 'destructive'),
        },
      );
    } else {
      createManager.mutate(
        { model: 'manager', data: { ...payload, status: 'active' } },
        {
          onSuccess: () => {
            showToast('Added', 'Manager added successfully.');
            setManagerDialogOpen(false);
          },
          onError: () => showToast('Error', 'Failed to add manager.', 'destructive'),
        },
      );
    }
  }, [managerForm, editingManagerId, createManager, updateManager, showToast]);

  const handleDeleteManager = useCallback((id: string) => {
    deleteManager.mutate(
      { model: 'manager', id },
      {
        onSuccess: () => showToast('Deleted', 'Manager removed.'),
        onError: () => showToast('Error', 'Failed to delete manager.', 'destructive'),
      },
    );
  }, [deleteManager, showToast]);

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (!s) {
    return (
      <div className="flex flex-col gap-4 p-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-500/10">
          <Settings className="size-5 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your application configuration</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="pr-1">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="profile" className="gap-1.5 text-xs">
              <Building2 className="size-3.5" /> Profile
            </TabsTrigger>
            <TabsTrigger value="managers" className="gap-1.5 text-xs">
              <Users className="size-3.5" /> Managers
            </TabsTrigger>
            <TabsTrigger value="llm" className="gap-1.5 text-xs">
              <Bot className="size-3.5" /> LLM & AI
            </TabsTrigger>
            <TabsTrigger value="sheets" className="gap-1.5 text-xs">
              <Sheet className="size-3.5" /> Sheets
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1.5 text-xs">
              <Palette className="size-3.5" /> Appearance
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 text-xs">
              <Bell className="size-3.5" /> Notifications
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════ Tab 1: Profile ═══════════════════ */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="size-4 text-emerald-500" /> Business Profile
                </CardTitle>
                <CardDescription>Your business details for invoices, reports, and GST compliance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="biz-name">Business Name</Label>
                    <Input
                      id="biz-name"
                      value={profile.businessName}
                      onChange={(e) => setProfile((p) => ({ ...p, businessName: e.target.value }))}
                      placeholder="Your business name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="biz-phone">Business Phone</Label>
                    <Input
                      id="biz-phone"
                      value={profile.businessPhone}
                      onChange={(e) => setProfile((p) => ({ ...p, businessPhone: e.target.value }))}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="biz-address">Business Address</Label>
                  <Textarea
                    id="biz-address"
                    value={profile.businessAddress}
                    onChange={(e) => setProfile((p) => ({ ...p, businessAddress: e.target.value }))}
                    placeholder="Full business address"
                    rows={3}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="biz-email">Business Email</Label>
                    <Input
                      id="biz-email"
                      type="email"
                      value={profile.businessEmail}
                      onChange={(e) => setProfile((p) => ({ ...p, businessEmail: e.target.value }))}
                      placeholder="contact@business.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="biz-gst">GST Number</Label>
                    <Input
                      id="biz-gst"
                      value={profile.businessGst}
                      onChange={(e) => setProfile((p) => ({ ...p, businessGst: e.target.value }))}
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button size="sm" onClick={saveProfile} disabled={isUpdating} className="gap-1.5 min-w-[120px]">
                    {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    {isUpdating ? 'Saving...' : 'Save Profile'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════ Tab 2: Managers ═══════════════════ */}
          <TabsContent value="managers">
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="size-4 text-emerald-500" /> Team Managers
                    </CardTitle>
                    <CardDescription>Manage who has access to your business data</CardDescription>
                  </div>
                  <Button size="sm" onClick={openAddManager} className="gap-1.5">
                    <Plus className="size-3.5" /> Add Manager
                  </Button>
                </CardHeader>
                <CardContent>
                  {managersLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : managers.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Users className="size-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No managers added yet</p>
                      <p className="text-xs">Click &quot;Add Manager&quot; to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {managers.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between rounded-lg border bg-card p-3 gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center justify-center size-10 rounded-full bg-emerald-500/10 text-emerald-500 font-medium text-sm shrink-0">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{m.name}</span>
                                <Badge
                                  variant={m.status === 'active' ? 'default' : 'secondary'}
                                  className={cn(
                                    'text-[10px] px-1.5 py-0',
                                    m.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10' : '',
                                  )}
                                >
                                  {m.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {m.phone && <span>{m.phone}</span>}
                                <span className="capitalize px-1.5 py-0 rounded bg-muted text-[10px]">{m.role}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEditManager(m)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive">
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Manager</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete <strong>{m.name}</strong>? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDeleteManager(m.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add / Edit Manager Dialog */}
              <Card className={cn('transition-all', managerDialogOpen ? 'block' : 'hidden')}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingManagerId ? 'Edit Manager' : 'Add New Manager'}
                  </CardTitle>
                  <CardDescription>
                    {editingManagerId ? 'Update manager details' : 'Add a new team member'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="mgr-name">Name *</Label>
                      <Input
                        id="mgr-name"
                        value={managerForm.name}
                        onChange={(e) => setManagerForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mgr-phone">Phone</Label>
                      <Input
                        id="mgr-phone"
                        value={managerForm.phone}
                        onChange={(e) => setManagerForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={managerForm.role}
                        onValueChange={(v) => setManagerForm((p) => ({ ...p, role: v }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {managerRoles.map((r) => (
                            <SelectItem key={r} value={r} className="capitalize">
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mgr-notes">Notes</Label>
                      <Input
                        id="mgr-notes"
                        value={managerForm.notes}
                        onChange={(e) => setManagerForm((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Optional notes"
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setManagerDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveManager}
                      disabled={createManager.isPending || updateManager.isPending}
                      className="gap-1.5 min-w-[120px]"
                    >
                      {(createManager.isPending || updateManager.isPending) ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Save className="size-3.5" />
                      )}
                      {(createManager.isPending || updateManager.isPending) ? 'Saving...' : 'Save Manager'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════════════════ Tab 3: LLM & AI ═══════════════════ */}
          <TabsContent value="llm">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="size-4 text-emerald-500" /> AI Configuration
                </CardTitle>
                <CardDescription>Configure the Gemini AI model for your smart assistant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Uses <span className="font-medium text-foreground">Google Gemini Free Tier</span> API. Get your free API key from{' '}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-500 underline underline-offset-2 hover:text-emerald-400"
                    >
                      Google AI Studio
                    </a>.
                    Free tier supports up to 15 requests/minute and 1M tokens context window.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={llm.modelName || 'gemini-2.5-flash'}
                    onValueChange={(v) => setLlm((p) => ({ ...p, modelName: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {geminiModels.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Gemini 2.5 Flash is recommended for best quality and speed</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="llm-key">
                    Gemini API Key <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="llm-key"
                      type={showApiKey ? 'text' : 'password'}
                      value={llm.apiKey}
                      onChange={(e) => setLlm((p) => ({ ...p, apiKey: e.target.value }))}
                      placeholder="AIzaSy..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 size-9"
                      onClick={() => setShowApiKey((v) => !v)}
                    >
                      {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                  {llm.apiKey && (
                    <p className="text-[11px] text-emerald-500 flex items-center gap-1">
                      <Check className="size-3" /> API key configured
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Temperature</Label>
                    <span className="text-xs text-muted-foreground tabular-nums font-mono">
                      {llm.temperature.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={llm.temperature}
                    onChange={(e) => setLlm((p) => ({ ...p, temperature: parseFloat(e.target.value) }))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Precise (0)</span>
                    <span>Creative (1)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="llm-tokens">Max Output Tokens</Label>
                  <Input
                    id="llm-tokens"
                    type="number"
                    value={llm.maxTokens}
                    onChange={(e) => setLlm((p) => ({ ...p, maxTokens: parseInt(e.target.value) || 8192 }))}
                    min={256}
                    max={65536}
                    placeholder="8192"
                  />
                  <p className="text-[11px] text-muted-foreground">Maximum response length (256–65536). Higher values use more quota.</p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Brain className="size-3.5 text-emerald-500" /> Thinking Mode
                    </Label>
                    <p className="text-xs text-muted-foreground">Extended reasoning for complex queries (uses more tokens)</p>
                  </div>
                  <Switch
                    checked={thinkingEnabled}
                    onCheckedChange={(v) => setThinkingEnabled(v)}
                  />
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button size="sm" onClick={saveLlm} disabled={isUpdating} className="gap-1.5 min-w-[120px]">
                    {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    {isUpdating ? 'Saving...' : 'Save AI Config'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════ Tab 4: Google Sheets ═════════════════ */}
          <TabsContent value="sheets">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sheet className="size-4 text-emerald-500" /> Google Sheets Integration
                  </CardTitle>
                  <CardDescription>Sync your business data with Google Sheets for backup and sharing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Connection Status */}
                  <div className="flex items-center gap-2 rounded-lg border p-3">
                    {s.googleSheetConnected ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/20 gap-1.5">
                        <Zap className="size-3" /> Connected
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1.5">
                        <AlertCircle className="size-3" /> Disconnected
                      </Badge>
                    )}
                    {s.lastSyncAt && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Last synced: {formatDate(s.lastSyncAt, 'DD/MM/YYYY HH:mm')}
                      </span>
                    )}
                  </div>

                  {s.lastSyncMessage && (
                    <div className="rounded-lg border bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Last sync message:</span> {s.lastSyncMessage}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="gsheet-id">Sheet ID</Label>
                    <Input
                      id="gsheet-id"
                      value={sheets.sheetId}
                      onChange={(e) => setSheets((p) => ({ ...p, sheetId: e.target.value }))}
                      placeholder="Enter Google Sheet ID"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      From URL: docs.google.com/spreadsheets/d/<span className="text-emerald-500 font-medium">[SHEET_ID]</span>/edit
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gsheet-key">Sheet API Key</Label>
                    <div className="relative">
                      <Input
                        id="gsheet-key"
                        type={showSheetKey ? 'text' : 'password'}
                        value={sheets.apiKey}
                        onChange={(e) => setSheets((p) => ({ ...p, apiKey: e.target.value }))}
                        placeholder="Google API key"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 size-9"
                        onClick={() => setShowSheetKey((v) => !v)}
                      >
                        {showSheetKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={saveAndConnectSheets}
                      disabled={isUpdating || !sheets.sheetId.trim()}
                      className="gap-1.5"
                    >
                      {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <Shield className="size-3.5" />}
                      Save & Connect
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testConnection}
                      disabled={isSyncing}
                      className="gap-1.5"
                    >
                      <RefreshCw className={cn('size-3.5', isSyncing && 'animate-spin')} />
                      Test Connection
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={syncDataNow}
                      disabled={isSyncing || (!s.googleSheetConnected && !sheets.sheetId.trim())}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {isSyncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                      {isSyncing ? 'Syncing...' : 'Sync Data'}
                    </Button>
                  </div>

                  {/* Remove Duplicates */}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Remove Duplicate Transactions</Label>
                      <p className="text-xs text-muted-foreground">Find and remove duplicate payments & expenses from past syncs</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const result = await syncSheets('deduplicate');
                          if (result.success) {
                            showToast('Duplicates Removed', result.message);
                          } else {
                            showToast('Error', result.error || 'Failed to remove duplicates', 'destructive');
                          }
                        } catch {
                          showToast('Error', 'Failed to remove duplicates', 'destructive');
                        }
                      }}
                      disabled={isSyncing}
                      className="gap-1.5"
                    >
                      {isSyncing ? <Loader2 className="size-3.5 animate-spin" /> : <CopyX className="size-3.5" />}
                      {isSyncing ? 'Cleaning...' : 'Remove Duplicates'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Auto Sync Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="size-4 text-emerald-500" /> Auto Sync
                  </CardTitle>
                  <CardDescription>Automatically sync data at regular intervals</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Enable Auto Sync</Label>
                      <p className="text-xs text-muted-foreground">Automatically pull data from Google Sheets</p>
                    </div>
                    <Switch
                      checked={s.autoSync ?? false}
                      onCheckedChange={toggleAutoSync}
                    />
                  </div>

                  {(s.autoSync) && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label>Sync Interval</Label>
                        <Select
                          value={String(s.syncInterval || 60)}
                          onValueChange={handleSyncIntervalChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {syncIntervals.map((si) => (
                              <SelectItem key={si.value} value={String(si.value)}>
                                {si.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-lg border bg-emerald-500/5 p-3">
                        <p className="text-xs text-muted-foreground flex items-start gap-2">
                          <Clock className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          Auto sync runs every <strong>{syncIntervals.find((si) => si.value === (s.syncInterval || 60))?.label || '60 minutes'}</strong>. Data is cached locally for speed.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════════════════ Tab 5: Appearance ═══════════════════ */}
          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="size-4 text-emerald-500" /> Appearance
                </CardTitle>
                <CardDescription>Customize the look and feel of your workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Theme</Label>
                  <div className="flex gap-3">
                    <Button
                      variant={appearance.theme === 'dark' ? 'default' : 'outline'}
                      size="sm"
                      className="gap-2"
                      onClick={() => handleThemeToggle('dark')}
                    >
                      <Moon className="size-4" /> Dark
                    </Button>
                    <Button
                      variant={appearance.theme === 'light' ? 'default' : 'outline'}
                      size="sm"
                      className="gap-2"
                      onClick={() => handleThemeToggle('light')}
                    >
                      <Sun className="size-4" /> Light
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Accent Color</Label>
                  <div className="grid grid-cols-8 gap-2">
                    {accentColors.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        className={cn(
                          'size-9 rounded-full transition-all flex items-center justify-center',
                          color.class,
                          appearance.accentColor === color.name
                            ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110'
                            : 'hover:scale-105 opacity-70 hover:opacity-100',
                        )}
                        onClick={() => setAppearance((p) => ({ ...p, accentColor: color.name }))}
                        title={color.name}
                      >
                        {appearance.accentColor === color.name && <Check className="size-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Currency</Label>
                  <Select
                    value={appearance.currency}
                    onValueChange={(v) => setAppearance((p) => ({ ...p, currency: v }))}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button size="sm" onClick={saveAppearance} disabled={isUpdating} className="gap-1.5 min-w-[140px]">
                    {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    {isUpdating ? 'Saving...' : 'Save Appearance'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════ Tab 6: Notifications ═══════════════════ */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="size-4 text-emerald-500" /> Notification Preferences
                </CardTitle>
                <CardDescription>Control which alerts and reminders you receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Enable Notifications</Label>
                    <p className="text-xs text-muted-foreground">Receive in-app notifications</p>
                  </div>
                  <Switch
                    checked={s.notificationsEnabled ?? true}
                    onCheckedChange={(v) => toggleNotification('notificationsEnabled', v)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Task Reminders</Label>
                    <p className="text-xs text-muted-foreground">Get reminded about upcoming and overdue tasks</p>
                  </div>
                  <Switch
                    checked={s.taskReminders ?? true}
                    onCheckedChange={(v) => toggleNotification('taskReminders', v)}
                    disabled={!(s.notificationsEnabled ?? true)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Payment Alerts</Label>
                    <p className="text-xs text-muted-foreground">Alerts for due payments and receivables</p>
                  </div>
                  <Switch
                    checked={s.paymentAlerts ?? true}
                    onCheckedChange={(v) => toggleNotification('paymentAlerts', v)}
                    disabled={!(s.notificationsEnabled ?? true)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
}

// ── Helper icon (avoid importing non-existent Settings2Icon) ───────────────────

function Settings2Icon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </svg>
  );
}
