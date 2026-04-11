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
} from 'lucide-react';
import { useChat } from '@/hooks/use-data';
import { useAppStore } from '@/stores/app-store';
import { useSettings } from '@/hooks/use-data';
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
        <div className="mt-1.5 pl-5 text-xs text-muted-foreground italic leading-relaxed whitespace-pre-wrap">
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
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* AI avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="w-3.5 h-3.5 text-emerald-500" />
        </div>
      )}

      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
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
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
          {!isUser && msg.toolUsed && (
            <Badge
              variant="secondary"
              className="text-[10px] h-4 px-1.5 py-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
            >
              ⚡ Tool
            </Badge>
          )}
        </div>
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
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
        <Bot className="w-8 h-8 text-emerald-500" />
      </div>
      <h3 className="text-lg font-semibold mb-1">
        GenuineOS AI Assistant
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4 leading-relaxed">
        {hasApiKey
          ? 'I can help you manage your business. Try these:'
          : 'Set up your Gemini API key to get started.'}
      </p>

      {!hasApiKey && (
        <div className="mb-6 space-y-3 w-full max-w-sm">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-medium text-amber-500">API Key Required</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Go to Settings &gt; AI Configuration and add your free Gemini API key from Google AI Studio.
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
  } = useAppStore();

  const [input, setInput] = useState('');
  const [memoryOpen, setMemoryOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const s = settings as Record<string, any> | undefined;
  const hasApiKey = !!s?.apiKey;
  const modelName = s?.model || 'gemini-2.5-flash';

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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    const maxHeight = 4 * 24; // ~4 rows
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  };

  return (
    <div className="h-full flex flex-col">
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
      <ScrollArea className="flex-1 overflow-auto">
        <div className="p-4 space-y-4 min-h-0">
          {chatMessages.length === 0 ? (
            <WelcomeScreen onSend={sendMessage} hasApiKey={hasApiKey} onGoToSettings={() => setActiveTab('settings')} />
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
      <div className="p-3 flex-shrink-0">
        {!hasApiKey && (
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-amber-500">
            <AlertCircle className="w-3 h-3" />
            <span>Add your Gemini API key in Settings to start chatting</span>
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
            onClick={handleSend}
            disabled={!input.trim() || isChatLoading || !hasApiKey}
            size="icon"
            className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
