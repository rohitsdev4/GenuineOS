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
  chatLoaded: boolean;
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
const THINKING_KEY = 'genuineos_thinking';

// Load persisted state from localStorage (memory/thinking only — chat goes to IndexedDB)
function loadMemory(): string {
  if (typeof window !== 'undefined') {
    try { return localStorage.getItem(MEMORY_KEY) || ''; } catch { return ''; }
  }
  return '';
}

function loadThinking(): boolean {
  if (typeof window !== 'undefined') {
    try { return localStorage.getItem(THINKING_KEY) === 'true'; } catch { return false; }
  }
  return false;
}

// Load chat messages from IndexedDB
async function loadChatFromIndexedDB(): Promise<ChatMessage[]> {
  if (typeof window === 'undefined') return [];
  try {
    const { db } = await import('@/lib/indexeddb');
    const msgs = await db.chatMessage.orderBy('timestamp').toArray();
    return msgs.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      timestamp: new Date(m.timestamp),
      toolUsed: m.toolUsed,
      thinkingProcess: m.thinkingProcess,
    }));
  } catch (err) {
    console.warn('[Store] Failed to load chat from IndexedDB, trying localStorage fallback:', err);
    // Fallback: try localStorage migration
    try {
      const saved = localStorage.getItem('genuineos_chat');
      if (saved) {
        const old = JSON.parse(saved);
        localStorage.removeItem('genuineos_chat');
        return old;
      }
    } catch { /* ignore */ }
    return [];
  }
}

// Save chat message to IndexedDB
async function saveChatToIndexedDB(msg: ChatMessage) {
  if (typeof window === 'undefined') return;
  try {
    const { db } = await import('@/lib/indexeddb');
    await db.chatMessage.put({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp).toISOString(),
      toolUsed: msg.toolUsed,
      thinkingProcess: msg.thinkingProcess,
    });
    // Keep only last 200 messages in IndexedDB to prevent bloat
    const count = await db.chatMessage.count();
    if (count > 200) {
      const oldest = await db.chatMessage.orderBy('timestamp').limit(count - 200).toArray();
      await db.chatMessage.bulkDelete(oldest.map((m) => m.id));
    }
  } catch (err) {
    console.warn('[Store] Failed to save chat to IndexedDB:', err);
  }
}

// Clear all chat messages from IndexedDB
async function clearChatFromIndexedDB() {
  if (typeof window === 'undefined') return;
  try {
    const { db } = await import('@/lib/indexeddb');
    await db.chatMessage.clear();
  } catch (err) {
    console.warn('[Store] Failed to clear chat from IndexedDB:', err);
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  // UI
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Chat — start with empty, load from IndexedDB on mount
  chatMessages: [],
  chatLoaded: false,
  addChatMessage: (msg) => {
    set((s) => ({ chatMessages: [...s.chatMessages, msg] }));
    // Persist to IndexedDB (async, don't block)
    saveChatToIndexedDB(msg);
  },
  clearChatMessages: () => {
    set({ chatMessages: [] });
    clearChatFromIndexedDB();
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

// ── Chat hydration: load from IndexedDB on first client render ──
if (typeof window !== 'undefined') {
  loadChatFromIndexedDB().then((msgs) => {
    const current = useAppStore.getState();
    if (!current.chatLoaded) {
      useAppStore.setState({ chatMessages: msgs, chatLoaded: true });
    }
  });
}
