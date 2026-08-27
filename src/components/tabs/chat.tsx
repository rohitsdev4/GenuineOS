'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import {
  Send,
  Trash2,
  Bot,
  User,
  Brain,
  ChevronDown,
  ChevronUp,
  Settings,
  AlertCircle,
  CheckCircle2,
  Copy,
  FileText,
  Table2,
  Presentation,
  ReceiptText,
  Loader2,
  Download,
  X,
} from 'lucide-react';
import { useChat } from '@/hooks/use-data';
import { useAppStore } from '@/stores/app-store';
import { useSettings } from '@/hooks/use-data';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import ReactMarkdown from 'react-markdown';

const suggestions = [
  'Show me a financial summary',
  'Add payment 5000 from Ramesh',
  'What tasks are pending?',
  'Calculate 15000 * 12',
];

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ── Thinking collapsible ─────────────────────────────────────────── */
function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <Brain className="w-3.5 h-3.5 text-emerald-500" />
        <span className="italic">Thinking process</span>
        {open ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      {open && (
        <div className="mt-1.5 pl-5 text-xs text-muted-foreground italic leading-relaxed whitespace-pre-wrap break-words">
          {text}
        </div>
      )}
    </div>
  );
}

/* ── Typing indicator ─────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-1">
        <Bot className="w-3.5 h-3.5 text-emerald-500" />
      </div>
      <div className="bg-card border rounded-xl px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="flex gap-1">
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
          </span>
          <span className="text-sm text-muted-foreground ml-1">Thinking...</span>
        </div>
      </div>
    </div>
  );
}

/* ── Message bubble ───────────────────────────────────────────────── */
function MessageBubble({ msg }: { msg: import('@/stores/app-store').ChatMessage }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex gap-3 w-full max-w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* AI avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="w-3.5 h-3.5 text-emerald-500" />
        </div>
      )}

      <div
        className={`max-w-[85%] min-w-0 break-words overflow-hidden rounded-xl px-4 py-2.5 ${
          isUser
            ? 'bg-emerald-600 text-white rounded-br-md'
            : 'bg-card border rounded-bl-md'
        }`}
      >
        {/* Thinking block */}
        {!isUser && msg.thinkingProcess && (
          <ThinkingBlock text={msg.thinkingProcess} />
        )}

        {/* Content */}
        {!isUser ? (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-pre:overflow-x-auto prose-pre:max-w-full prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className={`text-[10px] ${
              isUser ? 'text-white/60' : 'text-muted-foreground'
            }`}
          >
            {formatTime(msg.timestamp)}
          </span>
          {!isUser && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(msg.content);
                // Optional: you could add a local state here to change the icon to a Check briefly, but this works functionally.
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              title="Copy message"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          )}
          
          {!isUser && msg.toolUsed && (
            <Badge
              variant="secondary"
              className="text-[10px] h-4 px-1.5 py-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
            >
              ⚡ Tool
            </Badge>
          )}
        </div>

        {/* Display Tool Result if it's fetched data */}
        {!isUser && msg.toolResult && msg.toolResult.data && Array.isArray(msg.toolResult.data) && msg.toolResult.data.length > 0 && (
          <div className="mt-3 text-xs bg-muted/30 rounded-lg p-2 max-h-60 overflow-auto break-words max-w-full border border-emerald-500/20">
             {msg.toolResult.data.map((item: any) => (
                <div key={item.id} className="border-b last:border-0 border-border/50 py-1.5 px-1">
                  {Object.entries(item)
                    .filter(([k, v]) => !['id', 'createdAt', 'updatedAt', 'siteId', 'managerId'].includes(k) && v !== null && v !== '')
                    .map(([k, v]) => (
                    <span key={k} className="mr-3 inline-block align-top break-words">
                      <span className="text-muted-foreground font-medium capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}:</span>{' '}
                      <span className="text-foreground">{String(v)}</span>
                    </span>
                  ))}
                </div>
             ))}
          </div>
        )}
        
        {!isUser && msg.toolResult && msg.toolResult.data && Array.isArray(msg.toolResult.data) && msg.toolResult.data.length === 0 && (
          <div className="mt-3 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 border border-emerald-500/20">
             No records found.
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
    </div>
  );
}

/* ── Welcome screen ───────────────────────────────────────────────── */
function WelcomeScreen({ onSend, hasApiKey, onGoToSettings }: { onSend: (msg: string) => void; hasApiKey: boolean; onGoToSettings: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center w-full max-w-full overflow-hidden">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
        <Bot className="w-8 h-8 text-emerald-500" />
      </div>
      <h3 className="text-lg font-semibold mb-1">
        GenuineOS AI Assistant
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4 leading-relaxed">
        {hasApiKey
          ? 'I can help you manage your business. Try these:'
          : 'Set up your NVIDIA NIM API key to get started.'}
      </p>

      {!hasApiKey && (
        <div className="mb-6 space-y-3 w-full max-w-sm">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-medium text-amber-500">API Key Required</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Go to Settings &gt; AI Configuration and add your NVIDIA NIM API key from{' '}
                  <a href="https://build.nvidia.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-500 underline">NVIDIA Build</a>.
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onGoToSettings}
            className="gap-1.5"
          >
            <Settings className="w-3.5 h-3.5" /> Go to Settings
          </Button>
        </div>
      )}

      {hasApiKey && (
        <div className="flex flex-wrap gap-2 justify-center">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSend(s)}
              className="px-3 py-2 text-sm rounded-lg border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Memory panel ─────────────────────────────────────────────────── */
function MemoryPanel() {
  const { memoryContext, setMemoryContext } = useAppStore();

  return (
    <div className="border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4 text-emerald-500" />
        <span className="text-sm font-medium">Memory</span>
      </div>
      <Textarea
        value={memoryContext}
        onChange={(e) => setMemoryContext(e.target.value)}
        placeholder="e.g. My business is a construction company in Bangalore with 15 employees..."
        className="min-h-[80px] max-h-40 resize-none text-sm"
        rows={3}
      />
      <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
        Add context about your business for more personalized responses
      </p>
    </div>
  );
}

/* ── Main chat tab ────────────────────────────────────────────────── */

export default function ChatTab() {
  const { sendMessage } = useChat();
  const { data: settings } = useSettings();
  const {
    chatMessages,
    clearChatMessages,
    isChatLoading,
    thinkingEnabled,
    setThinkingEnabled,
    setActiveTab,
    nvidiaApiKey,
    nvidiaModel,
    nvidiaBaseUrl,
  } = useAppStore();

  const [input, setInput] = useState('');

  const [memoryOpen, setMemoryOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genKind, setGenKind] = useState<'invoice' | 'estimate' | 'xlsx' | 'pptx'>('invoice');
  const [genForm, setGenForm] = useState<GenForm>(emptyGenForm('invoice'));
  const [genBusy, setGenBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasApiKey = !!nvidiaApiKey;
  const modelName = nvidiaModel || 'NVIDIA NIM (GLM 5.1)';

  // Auto-scroll to bottom when messages change or loading starts
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isChatLoading) return;
    sendMessage(trimmed);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openGen = (kind: 'invoice' | 'estimate' | 'xlsx' | 'pptx') => {
    setGenKind(kind);
    setGenForm(emptyGenForm(kind));
    setGenOpen(true);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    const maxHeight = 4 * 24; // ~4 rows
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  };

  return (
    <div className="h-full w-full max-w-full flex flex-col overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-base font-semibold leading-tight">AI Assistant</h2>
            <div className="flex items-center gap-1.5">
              {hasApiKey ? (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> {modelName}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0 bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1">
                  <AlertCircle className="w-2.5 h-2.5" /> No API Key
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Memory toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMemoryOpen((v) => !v)}
                  className={`h-8 px-2 gap-1.5 ${memoryOpen ? 'text-emerald-600' : 'text-muted-foreground'}`}
                >
                  <Brain className="w-4 h-4" />
                  <span className="text-xs hidden sm:inline">Memory</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle memory panel</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Thinking toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Switch
                    id="thinking-toggle"
                    checked={thinkingEnabled}
                    onCheckedChange={setThinkingEnabled}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                  <label
                    htmlFor="thinking-toggle"
                    className="text-xs text-muted-foreground cursor-pointer select-none"
                  >
                    Thinking
                  </label>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">Enable extended reasoning</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Clear chat */}
          {chatMessages.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearChatMessages}
                    className="text-muted-foreground hover:text-destructive h-8 px-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Clear chat</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* ── Memory panel (collapsible) ──────────────────────────── */}
      {memoryOpen && (
        <div className="px-4 pt-3 flex-shrink-0">
          <MemoryPanel />
          <Separator className="mt-3" />
        </div>
      )}

      {/* ── Message area ────────────────────────────────────────── */}
      <ScrollArea className="flex-1 min-h-0 w-full max-w-full [&_[data-radix-scroll-area-viewport]]:overflow-x-hidden [&_[data-radix-scroll-area-viewport]]:overscroll-x-contain">
        <div className="p-4 space-y-4 w-full max-w-full">
          {chatMessages.length === 0 ? (
            <WelcomeScreen onSend={(msg) => {
              setInput(msg);
              setTimeout(() => {
                 document.getElementById('chat-send-btn')?.click();
              }, 10);
            }} hasApiKey={hasApiKey} onGoToSettings={() => setActiveTab('settings')} />
          ) : (
            <>
              {chatMessages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}

              {isChatLoading && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* ── Input area ──────────────────────────────────────────── */}
      <div className="p-3 flex-shrink-0 w-full max-w-full">
        {/* Generate toolbar */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground mr-0.5">Generate:</span>
          <GenButton icon={<ReceiptText className="size-3.5" />} label="Invoice" onClick={() => openGen('invoice')} />
          <GenButton icon={<FileText className="size-3.5" />} label="Estimate" onClick={() => openGen('estimate')} />
          <GenButton icon={<Table2 className="size-3.5" />} label="Excel" onClick={() => openGen('xlsx')} />
          <GenButton icon={<Presentation className="size-3.5" />} label="PPT" onClick={() => openGen('pptx')} />
        </div>
        {!hasApiKey && (
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-amber-500">
            <AlertCircle className="w-3 h-3" />
            <span>Add your NVIDIA NIM API key in Settings to start chatting</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey ? "Ask me anything..." : "Set up API key in Settings first..."}
            className="min-h-[40px] max-h-24 resize-none rounded-xl border-border/50 bg-card/50 text-sm flex-1"
            rows={1}
            disabled={isChatLoading || !hasApiKey}
          />
          <Button
            id="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isChatLoading || !hasApiKey}
            size="icon"
            className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <GenerateDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        kind={genKind}
        form={genForm}
        setForm={setGenForm}
        busy={genBusy}
        setBusy={setGenBusy}
        settings={settings}
      />
    </div>
  );
}

/* ── File generation toolbar + dialog (invoice / estimate / Excel / PPT) ── */

function GenButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="h-7 gap-1.5 rounded-full px-2.5 text-[11px] text-muted-foreground hover:text-foreground">
      {icon}
      {label}
    </Button>
  );
}

interface GenForm {
  docNumber: string;
  date: string;
  clientName: string;
  businessName: string;
  itemsText: string;
  taxRate: number;
  discount: number;
  notes: string;
  fileName: string;
  sheetName: string;
  headersText: string;
  rowsText: string;
  title: string;
  subtitle: string;
  slidesText: string;
}

function emptyGenForm(kind: string): GenForm {
  const today = new Date().toISOString().slice(0, 10);
  if (kind === 'xlsx') {
    return {
      docNumber: '', date: today, clientName: '', businessName: '', itemsText: '', taxRate: 0, discount: 0, notes: '',
      fileName: 'data-sheet', sheetName: 'Sheet1', headersText: 'Item, Qty, Rate',
      rowsText: 'Laptop, 2, 45000\nChair, 5, 3500\nTotal, , =SUM(B2:B3)',
      title: '', subtitle: '', slidesText: '',
    };
  }
  if (kind === 'pptx') {
    return {
      docNumber: '', date: today, clientName: '', businessName: '', itemsText: '', taxRate: 0, discount: 0, notes: '',
      fileName: '', sheetName: '', headersText: '', rowsText: '',
      title: 'Business Presentation', subtitle: today,
      slidesText: 'Agenda::Revenue growth|New markets|Roadmap\nFinancials::1.2 Cr total|18% YoY growth|Top: North zone',
    };
  }
  return {
    docNumber: '', date: today, clientName: '', businessName: '', itemsText: 'Laptop | 2 | 45000\nChair | 5 | 3500',
    taxRate: 18, discount: 0, notes: '', fileName: '', sheetName: '', headersText: '', rowsText: '',
    title: '', subtitle: '', slidesText: '',
  };
}

function buildGenPayload(kind: string, form: GenForm, settings: any) {
  if (kind === 'xlsx') {
    const headers = form.headersText.split(',').map((h) => h.trim()).filter(Boolean);
    const rows: (string | number)[][] = form.rowsText
      .split('\n')
      .map((line) => line.split(',').map((cell) => {
        const t = cell.trim();
        if (t === '') return '';
        if (t.startsWith('=')) return t; // formula
        const n = Number(t.replace(/,/g, ''));
        return t !== '' && !isNaN(n) ? n : t;
      }))
      .filter((r) => r.some((c) => c !== '' && c !== 0));
    return {
      fileName: form.fileName || 'data-sheet',
      sheets: [{ name: form.sheetName || 'Sheet1', headers, rows }],
    };
  }
  if (kind === 'pptx') {
    const slides = form.slidesText
      .split('\n')
      .map((line) => {
        const [title, bulletsPart] = line.split('::');
        return { title: (title || '').trim(), bullets: (bulletsPart || '').split('|').map((b) => b.trim()).filter(Boolean) };
      })
      .filter((s) => s.title);
    return { title: form.title || 'Presentation', subtitle: form.subtitle || '', slides };
  }
  const items = form.itemsText
    .split('\n')
    .map((line) => line.split('|').map((p) => p.trim()))
    .filter((parts) => parts[0])
    .map((parts) => ({
      description: parts[0],
      qty: Number(parts[1]) || 1,
      rate: Number((parts[2] || '').replace(/,/g, '')) || 0,
    }));
  return {
    docNumber: form.docNumber || (kind === 'invoice' ? 'INV-' + Date.now().toString().slice(-6) : 'EST-' + Date.now().toString().slice(-6)),
    date: form.date || new Date().toISOString().slice(0, 10),
    dueDays: kind === 'invoice' ? 15 : undefined,
    business: { name: form.businessName || settings?.businessName || 'GenuineOS Business', address: settings?.businessAddress || undefined, phone: settings?.businessPhone || undefined, email: settings?.businessEmail || undefined },
    client: { name: form.clientName || 'Walk-in Client' },
    items,
    taxRate: form.taxRate,
    discount: form.discount,
    notes: form.notes || undefined,
  };
}

function GenerateDialog({ open, onOpenChange, kind, form, setForm, busy, setBusy, settings }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: 'invoice' | 'estimate' | 'xlsx' | 'pptx';
  form: GenForm;
  setForm: React.Dispatch<React.SetStateAction<GenForm>>;
  busy: boolean;
  setBusy: (v: boolean) => void;
  settings: any;
}) {
  const { toast } = useToast();
  const set = (patch: Partial<GenForm>) => setForm((f) => ({ ...f, ...patch }));

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const payload = buildGenPayload(kind, form, settings);
      const res = await fetch('/api/files/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: kind, payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      const a = document.createElement('a');
      a.href = `data:${data.mime};base64,${data.base64}`;
      a.download = data.filename || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: 'Downloaded', description: `${data.filename} generated locally.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to generate file.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const kindTitle = kind === 'xlsx' ? 'Excel Sheet' : kind === 'pptx' ? 'PowerPoint' : kind === 'invoice' ? 'Invoice' : 'Estimate';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {kind === 'xlsx' ? <Table2 className="size-4 text-emerald-500" /> : kind === 'pptx' ? <Presentation className="size-4 text-emerald-500" /> : <ReceiptText className="size-4 text-emerald-500" />}
            Generate {kindTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {kind === 'invoice' || kind === 'estimate' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Document Number</Label>
                  <Input value={form.docNumber} onChange={(e) => set({ docNumber: e.target.value })} placeholder="Auto" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className="text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Client Name</Label>
                  <Input value={form.clientName} onChange={(e) => set({ clientName: e.target.value })} placeholder="Ramesh Kumar" className="text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Your Business Name</Label>
                  <Input value={form.businessName} onChange={(e) => set({ businessName: e.target.value })} placeholder={settings?.businessName || 'GenuineOS Business'} className="text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Line Items <span className="text-muted-foreground">(one per line: description | qty | rate)</span></Label>
                <Textarea value={form.itemsText} onChange={(e) => set({ itemsText: e.target.value })} rows={4} className="font-mono text-xs" placeholder="Cement | 50 | 380&#10;Steel rods | 20 | 4500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tax %</Label>
                  <Input type="number" min={0} max={100} value={form.taxRate} onChange={(e) => set({ taxRate: Number(e.target.value) || 0 })} className="text-xs tabular-nums" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Discount</Label>
                  <Input type="number" min={0} value={form.discount} onChange={(e) => set({ discount: Number(e.target.value) || 0 })} className="text-xs tabular-nums" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Input value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Payment terms..." className="text-xs" />
                </div>
              </div>
            </>
          ) : kind === 'xlsx' ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">File Name</Label>
                  <Input value={form.fileName} onChange={(e) => set({ fileName: e.target.value })} className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Sheet Name</Label>
                  <Input value={form.sheetName} onChange={(e) => set({ sheetName: e.target.value })} className="text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Headers <span className="text-muted-foreground">(comma)</span></Label>
                  <Input value={form.headersText} onChange={(e) => set({ headersText: e.target.value })} className="font-mono text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rows <span className="text-muted-foreground">(one row per line, comma-separated; formulas allowed e.g. =SUM(B2:B3))</span></Label>
                <Textarea value={form.rowsText} onChange={(e) => set({ rowsText: e.target.value })} rows={6} className="font-mono text-xs" />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Title</Label>
                  <Input value={form.title} onChange={(e) => set({ title: e.target.value })} className="text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subtitle</Label>
                  <Input value={form.subtitle} onChange={(e) => set({ subtitle: e.target.value })} className="text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Slides <span className="text-muted-foreground">(one per line: Title::bullet1|bullet2)</span></Label>
                <Textarea value={form.slidesText} onChange={(e) => set({ slidesText: e.target.value })} rows={6} className="font-mono text-xs" />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {busy ? 'Generating...' : 'Generate & Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
