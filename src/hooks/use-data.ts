'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import {
  fetchData as dsFetchData,
  createRecord,
  updateRecord,
  deleteRecord,
  getSummary,
  getSettings,
  updateSettings as dsUpdateSettings,
  deduplicatePayments,
  deduplicateExpenses,
  importSheetData,
} from '@/lib/data-service';

interface FetchParams {
  model: string; id?: string; page?: number; limit?: number;
  search?: string; sortBy?: string; sortOrder?: string;
  include?: string; filterField?: string; filterValue?: string;
  filterField2?: string; filterValue2?: string;
  summary?: boolean; countByStatus?: boolean; statusField?: string;
  categoryBreakdown?: boolean;
}

export function useFetchData(params: FetchParams) {
  return useQuery({
    queryKey: ['data', params.model, params.id, params.page, params.search, params.filterField, params.filterValue, params.filterField2, params.filterValue2, params.summary, params.categoryBreakdown],
    queryFn: async () => {
      return dsFetchData(params);
    },
    staleTime: 10000,
  });
}

// Optimistic create (supports upsert)
export function useCreateData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ model, data, upsert }: { model: string; data: any; upsert?: boolean }) => {
      return createRecord(model, data, upsert);
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['data', v.model] });
      qc.invalidateQueries({ queryKey: ['summary'] });
    },
    onError: (err, v) => {
      console.error('[useCreateData] Failed to create:', v.model, err);
    },
  });
}

// Optimistic update
export function useUpdateData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ model, id, data }: { model: string; id: string; data: any }) => {
      return updateRecord(model, id, data);
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['data', v.model] });
      qc.invalidateQueries({ queryKey: ['summary'] });
    },
    onError: (err, v) => {
      console.error('[useUpdateData] Failed to update:', v.model, v.id, err);
    },
  });
}

export function useDeleteData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ model, id }: { model: string; id: string }) => {
      return deleteRecord(model, id);
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['data', v.model] });
      qc.invalidateQueries({ queryKey: ['summary'] });
    },
    onError: (err, v) => {
      console.error('[useDeleteData] Failed to delete:', v.model, v.id, err);
    },
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: async () => {
      return getSummary();
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
      return getSettings();
    },
    staleTime: 30000,
  });
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return dsUpdateSettings(data);
    },
    onSuccess: (data) => { qc.setQueryData(['settings'], data); },
  });
  return { ...query, updateSettings: updateSettingsMutation.mutateAsync, isUpdating: updateSettingsMutation.isPending };
}

export function useSheetsSync() {
  const store = useAppStore();
  const qc = useQueryClient();

  const syncSheets = async (action: 'connect' | 'test' | 'fetch' | 'sync' | 'deduplicate', sheetId?: string, apiKey?: string) => {
    store.setIsSyncing(true);
    store.setLastSyncResult(null);
    try {
      // Handle deduplicate client-side
      if (action === 'deduplicate') {
        const [paymentsRemoved, expensesRemoved] = await Promise.all([
          deduplicatePayments(),
          deduplicateExpenses(),
        ]);
        const msg = `Removed ${paymentsRemoved} duplicate payments and ${expensesRemoved} duplicate expenses`;
        store.setLastSyncResult(msg);
        qc.invalidateQueries({ queryKey: ['summary'] });
        qc.invalidateQueries({ queryKey: ['data'] });
        return { success: true, message: msg, paymentsRemoved, expensesRemoved };
      }

      // If credentials not provided, read from IndexedDB settings
      let effectiveSheetId = sheetId;
      let effectiveApiKey = apiKey;
      if (!effectiveSheetId || !effectiveApiKey) {
        try {
          const storedSettings = await getSettings();
          effectiveSheetId = effectiveSheetId || storedSettings.googleSheetId || '';
          effectiveApiKey = effectiveApiKey || storedSettings.googleApiKey || '';
        } catch {
          // Settings may not be available yet
        }
      }

      if (!effectiveSheetId || !effectiveApiKey) {
        const msg = 'Sheet ID and API Key are required. Please save them in Settings first.';
        store.setLastSyncResult(msg);
        return { success: false, error: msg };
      }

      // Server call for Google Sheets API (still needs server for Google API)
      const res = await fetch('/api/sheets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sheetId: effectiveSheetId, apiKey: effectiveApiKey }),
      });
      const data = await res.json();
      store.setLastSyncResult(data.message || (data.error || 'Unknown error'));

      if (data.success && data.sheetData) {
        // Import the raw sheet data into IndexedDB
        const { totalImported, sitesUpdated } = await importSheetData({
          ...data.sheetData,
          cleanSync: action === 'sync',
        });

        // Update settings with sync status
        await dsUpdateSettings({
          googleSheetId: effectiveSheetId || undefined,
          googleApiKey: effectiveApiKey || undefined,
          googleSheetConnected: true,
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: 'success',
          lastSyncMessage: `Synced! ${totalImported} records imported, ${sitesUpdated} sites updated`,
        });

        qc.invalidateQueries({ queryKey: ['summary'] });
        qc.invalidateQueries({ queryKey: ['settings'] });
        qc.invalidateQueries({ queryKey: ['data'] });

        return { ...data, totalImported, sitesUpdated };
      }

      if (data.success) {
        qc.invalidateQueries({ queryKey: ['summary'] });
        qc.invalidateQueries({ queryKey: ['settings'] });
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
  const qc = useQueryClient();

  const sendMessage = async (message: string) => {
    store.setChatLoading(true);
    store.addChatMessage({ id: crypto.randomUUID(), role: 'user', content: message, timestamp: new Date() });

    try {
      // Read API key and model from IndexedDB settings
      let apiKey = '';
      let model = 'gemini-2.5-flash';
      let temperature = 0.7;
      let maxTokens = 8192;
      try {
        const settings = await getSettings();
        apiKey = settings.apiKey || '';
        model = settings.model || 'gemini-2.5-flash';
        temperature = settings.temperature ?? 0.7;
        maxTokens = settings.maxTokens ?? 8192;
      } catch { /* settings not available */ }

      // Build history from last 20 messages (larger context window)
      const history = store.chatMessages.slice(-20).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          thinkingEnabled: store.thinkingEnabled,
          memoryContext: store.memoryContext,
          apiKey,
          model,
          temperature,
          maxTokens,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${res.status})`);
      }
      const data = await res.json();

      // Handle tool calls from server — execute client-side
      if (data.toolCall && data.toolCall.tool && data.toolCall.params) {
        const { createRecord: cr, updateRecord: ur, deleteRecord: dr, fetchData: fd } = await import('@/lib/data-service');

        // Execute the tool client-side
        let toolResult: any = null;
        try {
          const tool = data.toolCall.tool;
          const params = data.toolCall.params;

          switch (tool) {
            case 'ADD_PAYMENT':
              toolResult = await cr('payment', {
                party: params.party,
                amount: parseFloat(params.amount),
                date: params.date ? new Date(params.date).toISOString() : new Date().toISOString(),
                mode: params.mode || 'cash',
                category: params.category,
                notes: params.notes,
                siteId: params.siteId,
                reference: params.reference,
                managerId: params.managerId,
              });
              break;
            case 'ADD_EXPENSE':
              toolResult = await cr('expense', {
                title: params.title,
                amount: parseFloat(params.amount),
                date: params.date ? new Date(params.date).toISOString() : new Date().toISOString(),
                category: params.category || 'general',
                paidTo: params.paidTo,
                mode: params.mode || 'cash',
                notes: params.notes,
                siteId: params.siteId,
                billNo: params.billNo,
                managerId: params.managerId,
              });
              break;
            case 'ADD_RECEIVABLE':
              toolResult = await cr('receivable', {
                party: params.party,
                amount: parseFloat(params.amount),
                dueDate: params.dueDate ? new Date(params.dueDate).toISOString() : null,
                description: params.description,
                priority: params.priority || 'medium',
                notes: params.notes,
              });
              break;
            case 'UPDATE_RECEIVABLE':
              toolResult = await ur('receivable', params.id, {
                receivedAmount: params.receivedAmount !== undefined ? parseFloat(params.receivedAmount) : undefined,
                status: params.status,
                notes: params.notes,
              });
              break;
            case 'ADD_TASK':
              toolResult = await cr('task', {
                title: params.title,
                description: params.description,
                priority: params.priority || 'medium',
                dueDate: params.dueDate ? new Date(params.dueDate).toISOString() : null,
                tags: params.tags,
                siteId: params.siteId,
              });
              break;
            case 'UPDATE_TASK': {
              const upd: any = {};
              if (params.status) upd.status = params.status;
              if (params.priority) upd.priority = params.priority;
              if (params.status === 'completed') upd.completedAt = new Date().toISOString();
              toolResult = await ur('task', params.id, upd);
              break;
            }
            case 'ADD_SITE':
              toolResult = await cr('site', {
                name: params.name,
                location: params.location,
                contractValue: params.contractValue ? parseFloat(params.contractValue) : 0,
                pendingAmount: params.contractValue ? parseFloat(params.contractValue) : 0,
                contractor: params.contractor,
                startDate: params.startDate ? new Date(params.startDate).toISOString() : null,
                notes: params.notes,
              });
              break;
            case 'ADD_LABOUR':
              toolResult = await cr('labour', {
                name: params.name,
                role: params.role || 'worker',
                phone: params.phone,
                dailyWage: params.dailyWage ? parseFloat(params.dailyWage) : 0,
                siteId: params.siteId,
                notes: params.notes,
              });
              break;
            case 'ADD_CLIENT':
              toolResult = await cr('client', {
                name: params.name,
                phone: params.phone,
                email: params.email,
                address: params.address,
                gstNumber: params.gstNumber,
                type: params.type || 'customer',
              });
              break;
            case 'ADD_NOTE':
              toolResult = await cr('note', {
                title: params.title,
                content: params.content,
                category: params.category || 'general',
              });
              break;
            case 'DELETE_RECORD':
              toolResult = await dr(params.type, params.id);
              break;
          }

          // Invalidate react-query cache after mutation
          if (toolResult) {
            qc.invalidateQueries({ queryKey: ['data'] });
            qc.invalidateQueries({ queryKey: ['summary'] });
          }
        } catch (toolErr: any) {
          console.error('Tool execution error:', toolErr);
        }

        store.addChatMessage({
          id: crypto.randomUUID(), role: 'assistant', content: data.response,
          timestamp: new Date(), toolUsed: true, toolResult,
        });
      } else {
        store.addChatMessage({
          id: crypto.randomUUID(), role: 'assistant', content: data.response,
          timestamp: new Date(), toolUsed: data.toolUsed, thinkingProcess: data.thinkingProcess,
        });
      }
    } catch (e: any) {
      store.addChatMessage({ id: crypto.randomUUID(), role: 'assistant', content: `Error: ${e.message}`, timestamp: new Date() });
    } finally {
      store.setChatLoading(false);
    }
  };

  return { sendMessage };
}
