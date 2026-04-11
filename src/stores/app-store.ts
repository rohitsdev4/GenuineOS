import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolUsed?: boolean;
  thinkingProcess?: string;
}

interface AppState {
  // UI
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;
  clearChatMessages: () => void;
  isChatLoading: boolean;
  setChatLoading: (loading: boolean) => void;
  thinkingEnabled: boolean;
  setThinkingEnabled: (v: boolean) => void;
  memoryContext: string;
  setMemoryContext: (v: string) => void;

  // Sheets sync
  isSyncing: boolean;
  setIsSyncing: (v: boolean) => void;
  lastSyncResult: string | null;
  setLastSyncResult: (v: string | null) => void;

  // Refresh
  refreshKey: number;
  refresh: () => void;
}

const MEMORY_KEY = 'genuineos_memory';
const CHAT_KEY = 'genuineos_chat';
const THINKING_KEY = 'genuineos_thinking';

// Load persisted state
function loadMemory() {
  if (typeof window !== 'undefined') {
    try { return localStorage.getItem(MEMORY_KEY) || ''; } catch { return ''; }
  }
  return '';
}

function loadChat(): ChatMessage[] {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(CHAT_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }
  return [];
}

function loadThinking(): boolean {
  if (typeof window !== 'undefined') {
    try { return localStorage.getItem(THINKING_KEY) === 'true'; } catch { return false; }
  }
  return false;
}

export const useAppStore = create<AppState>((set, get) => ({
  // UI
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Chat
  chatMessages: loadChat(),
  addChatMessage: (msg) => {
    set((s) => {
      const updated = [...s.chatMessages, msg];
      // Persist to localStorage (keep last 50)
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(CHAT_KEY, JSON.stringify(updated.slice(-50))); } catch { /* ignore */ }
      }
      return { chatMessages: updated };
    });
  },
  clearChatMessages: () => {
    set({ chatMessages: [] });
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(CHAT_KEY); } catch { /* ignore */ }
    }
  },
  isChatLoading: false,
  setChatLoading: (loading) => set({ isChatLoading: loading }),
  thinkingEnabled: loadThinking(),
  setThinkingEnabled: (v) => {
    set({ thinkingEnabled: v });
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(THINKING_KEY, String(v)); } catch { /* ignore */ }
    }
  },
  memoryContext: loadMemory(),
  setMemoryContext: (v) => {
    set({ memoryContext: v });
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(MEMORY_KEY, v); } catch { /* ignore */ }
    }
  },

  // Sheets
  isSyncing: false,
  setIsSyncing: (v) => set({ isSyncing: v }),
  lastSyncResult: null,
  setLastSyncResult: (v) => set({ lastSyncResult: v }),

  // Refresh
  refreshKey: 0,
  refresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}));
