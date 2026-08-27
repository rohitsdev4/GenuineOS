// ─── Multi-provider AI engine (NVIDIA NIM → OpenRouter → Groq fallback) ─────
// All three expose OpenAI-compatible /chat/completions endpoints, so one client
// covers them all. Keys arrive from the browser (user-owned, stored locally) and
// fall back to server env vars so the Telegram bot can also use them.

import type { ChatMessage } from '@/lib/types';

export interface ProviderKeys {
  nim?: string;
  openrouter?: string;
  groq?: string;
}

interface ProviderDef {
  id: keyof ProviderKeys;
  name: string;
  baseUrl: string;
  defaultModel: string;
  envKey: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'nim',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    envKey: 'NIM_API_KEY',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.1-70b-instruct',
    envKey: 'OPENROUTER_API_KEY',
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    envKey: 'GROQ_API_KEY',
  },
];

/** Merge browser-supplied keys with server env fallback. */
export function resolveKeys(incoming: ProviderKeys | null | undefined): ProviderKeys {
  const merged: ProviderKeys = {};
  for (const p of PROVIDERS) {
    const k = (incoming?.[p.id] || process.env[p.envKey] || '').trim();
    if (k) merged[p.id] = k;
  }
  return merged;
}

export function providerPriority(keys: ProviderKeys): ProviderDef[] {
  return PROVIDERS.filter((p) => keys[p.id]);
}

function headersFor(p: ProviderDef, key: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (p.id === 'openrouter') {
    h['HTTP-Referer'] = 'https://manus-expert.vercel.app';
    h['X-Title'] = 'Manus Expert';
  }
  return h;
}

/** Non-streaming completion, tries providers in priority order. */
export async function callChat(
  keys: ProviderKeys,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<{ text: string; provider: string; model: string }> {
  const queue = providerPriority(keys);
  if (queue.length === 0) {
    throw new Error(
      'No AI provider key found. Add your NVIDIA NIM / OpenRouter / Groq key in Settings (or set env vars on Vercel).'
    );
  }
  let lastErr = '';
  for (const p of queue) {
    try {
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: headersFor(p, keys[p.id] as string),
        body: JSON.stringify({
          model: p.defaultModel,
          messages,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens ?? 2048,
        }),
      });
      if (!res.ok) {
        lastErr = `${p.name}: HTTP ${res.status}`;
        continue;
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === 'string' && text.length > 0) {
        return { text, provider: p.name, model: p.defaultModel };
      }
      lastErr = `${p.name}: empty response`;
    } catch (e) {
      lastErr = `${p.name}: ${(e as Error).message}`;
    }
  }
  throw new Error(`All providers failed. Last error → ${lastErr}`);
}

/** Streaming completion — yields text chunks, tries providers in order. */
export async function* streamChat(
  keys: ProviderKeys,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): AsyncGenerator<{ chunk: string; provider?: string; model?: string }, void, unknown> {
  const queue = providerPriority(keys);
  if (queue.length === 0) {
    throw new Error(
      'No AI provider key found. Add your NVIDIA NIM / OpenRouter / Groq key in Settings.'
    );
  }
  let lastErr = '';
  for (const p of queue) {
    let sentHeader = false;
    try {
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: headersFor(p, keys[p.id] as string),
        body: JSON.stringify({
          model: p.defaultModel,
          messages,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens ?? 2048,
          stream: true,
        }),
      });
      if (!res.ok || !res.body) {
        lastErr = `${p.name}: HTTP ${res.status}`;
        continue;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const payload = t.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            const delta = j?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              if (!sentHeader) {
                sentHeader = true;
                yield { chunk: delta, provider: p.name, model: p.defaultModel };
              } else {
                yield { chunk: delta };
              }
            }
          } catch {
            // ignore malformed keep-alive fragments
          }
        }
      }
      if (sentHeader) return;
      lastErr = `${p.name}: stream returned no content`;
    } catch (e) {
      lastErr = `${p.name}: ${(e as Error).message}`;
    }
  }
  throw new Error(`All providers failed. Last error → ${lastErr}`);
}

/** Extract the first ```filegen JSON block from a model reply. */
export function extractFilegen(text: string): { format: string; payload: unknown } | null {
  const re = /```filegen\s*([\s\S]*?)```/i;
  const m = text.match(re);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1].trim());
    if (parsed && typeof parsed.format === 'string' && parsed.payload) {
      return { format: parsed.format, payload: parsed.payload };
    }
  } catch {
    // try to salvage JSON with trailing commas removed
    try {
      const cleaned = m[1].trim().replace(/,\s*([}\]])/g, '$1');
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed.format === 'string' && parsed.payload) {
        return { format: parsed.format, payload: parsed.payload };
      }
    } catch {
      return null;
    }
  }
  return null;
}
