'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';

interface FetchParams {
  model: string; id?: string; page?: number; limit?: number;
  search?: string; sortBy?: string; sortOrder?: string;
  include?: string; filterField?: string; filterValue?: string;
  filterField2?: string; filterValue2?: string;
  summary?: boolean; countByStatus?: boolean; statusField?: string;
  categoryBreakdown?: boolean;
}

export function useFetchData(params: FetchParams) {
  const sp = new URLSearchParams();
  sp.set('model', params.model);
  if (params.id) sp.set('id', params.id);
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.search) sp.set('search', params.search);
  if (params.sortBy) sp.set('sortBy', params.sortBy);
  if (params.sortOrder) sp.set('sortOrder', params.sortOrder);
  if (params.include) sp.set('include', params.include);
  if (params.filterField) sp.set('filterField', params.filterField);
  if (params.filterValue) sp.set('filterValue', params.filterValue);
  if (params.filterField2) sp.set('filterField2', params.filterField2);
  if (params.filterValue2) sp.set('filterValue2', params.filterValue2);
  if (params.summary) sp.set('summary', 'true');
  if (params.countByStatus) sp.set('countByStatus', 'true');
  if (params.statusField) sp.set('statusField', params.statusField);
  if (params.categoryBreakdown) sp.set('categoryBreakdown', 'true');

  return useQuery({
    queryKey: ['data', params.model, params.id, params.page, params.search, params.filterField, params.filterValue, params.filterField2, params.filterValue2, params.summary, params.categoryBreakdown],
    queryFn: async () => {
      const res = await fetch(`/api/data?${sp.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 10000, // 10s stale time for speed
  });
}

// Optimistic create (supports upsert)
export function useCreateData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ model, data, upsert }: { model: string; data: any; upsert?: boolean }) => {
      const res = await fetch('/api/data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, data, upsert }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Create failed'); }
      return res.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['data', v.model] });
      qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

// Optimistic update
export function useUpdateData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ model, id, data }: { model: string; id: string; data: any }) => {
      const res = await fetch('/api/data', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, id, data }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Update failed'); }
      return res.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['data', v.model] });
      qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

export function useDeleteData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ model, id }: { model: string; id: string }) => {
      const res = await fetch(`/api/data?model=${model}&id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Delete failed'); }
      return res.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['data', v.model] });
      qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: async () => {
      const res = await fetch('/api/data?model=payment&summary=true');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 15000,
    staleTime: 5000,
  });
}

export function useSettings() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 30000,
  });
  const updateSettings = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: (data) => { qc.setQueryData(['settings'], data); },
  });
  return { ...query, updateSettings: updateSettings.mutate, isUpdating: updateSettings.isPending };
}

export function useSheetsSync() {
  const store = useAppStore();
  const qc = useQueryClient();

  const syncSheets = async (action: 'connect' | 'test' | 'fetch' | 'sync' | 'deduplicate', sheetId?: string, apiKey?: string) => {
    store.setIsSyncing(true);
    store.setLastSyncResult(null);
    try {
      const res = await fetch('/api/sheets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sheetId, apiKey }),
      });
      const data = await res.json();
      store.setLastSyncResult(data.message || (data.error || 'Unknown error'));
      if (data.success) {
        qc.invalidateQueries({ queryKey: ['summary'] });
        qc.invalidateQueries({ queryKey: ['settings'] });
        // Invalidate all data queries after sync/deduplicate
        qc.invalidateQueries({ queryKey: ['data'] });
      }
      return data;
    } catch (e: any) {
      store.setLastSyncResult(e.message);
      return { success: false, error: e.message };
    } finally {
      store.setIsSyncing(false);
    }
  };

  return { syncSheets, isSyncing: store.isSyncing, lastSyncResult: store.lastSyncResult };
}

export function useChat() {
  const store = useAppStore();

  const sendMessage = async (message: string) => {
    store.setChatLoading(true);
    store.addChatMessage({ id: crypto.randomUUID(), role: 'user', content: message, timestamp: new Date() });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: store.chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          thinkingEnabled: store.thinkingEnabled,
          memoryContext: store.memoryContext,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      store.addChatMessage({
        id: crypto.randomUUID(), role: 'assistant', content: data.response,
        timestamp: new Date(), toolUsed: data.toolUsed, thinkingProcess: data.thinkingProcess,
      });
    } catch (e: any) {
      store.addChatMessage({ id: crypto.randomUUID(), role: 'assistant', content: `Error: ${e.message}`, timestamp: new Date() });
    } finally {
      store.setChatLoading(false);
    }
  };

  return { sendMessage };
}
