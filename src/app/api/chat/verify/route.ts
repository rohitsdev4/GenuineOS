// ─── /api/chat/verify — test an OpenAI-compatible AI endpoint from Settings ──
// Checks that { baseUrl, model, apiKey } actually work BEFORE saving.
// Strategy: try GET {baseUrl}/models (cheap); if that 404s/403s on the model
// list, fall back to a tiny chat completion (max_tokens=1).

import { NextRequest } from 'next/server';

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'z-ai/glm-5.1';

export const runtime = 'nodejs';

interface VerifyBody {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}

export async function POST(req: NextRequest) {
  let body: VerifyBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const baseUrl = (body.baseUrl || DEFAULT_BASE).trim().replace(/\/+$/, '');
  const model = (body.model || DEFAULT_MODEL).trim();
  const apiKey = (body.apiKey || '').trim();

  if (!apiKey) {
    return Response.json({ ok: false, error: 'API key is required. Get one from build.nvidia.com (free).' }, { status: 400 });
  }
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    return Response.json({ ok: false, error: 'Base URL must start with http:// or https://' }, { status: 400 });
  }

  const started = Date.now();

  // 1) Try the models list endpoint (OpenAI-compatible convention)
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const ids: string[] = Array.isArray(data?.data) ? data.data.map((m: any) => m.id) : [];
      const matched = ids.includes(model) ? model : ids[0] || model;
      return Response.json({
        ok: true,
        latencyMs: Date.now() - started,
        model: matched,
        availableModels: ids.slice(0, 50),
        note: ids.includes(model)
          ? undefined
          : `Model "${model}" not found in this account's model list${ids[0] ? ` — showing "${ids[0]}" as first available. The custom model may still work.` : ''}`,
      });
    }
    // fall through to chat completion on 404/401/403
  } catch {
    // network error — fall through to chat completion attempt
  }

  // 2) Fallback: tiny chat completion with max_tokens=1
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        max_tokens: 1,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      const usedModel = data?.model || model;
      return Response.json({ ok: true, latencyMs: Date.now() - started, model: usedModel });
    }
    const msg = data?.error?.message || data?.error || `HTTP ${res.status}`;
    const hint =
      res.status === 401 || res.status === 403
        ? 'Invalid or unauthorized API key.'
        : res.status === 404
          ? 'Endpoint or model not found — check the Base URL and Model ID.'
          : res.status === 429
            ? 'Rate limited — try again in a minute.'
            : '';
    return Response.json({ ok: false, error: `${msg}${hint ? ' ' + hint : ''}`, status: res.status }, { status: res.status === 429 ? 429 : 400 });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: `Could not reach the endpoint: ${e?.message || 'network error'}` },
      { status: 502 }
    );
  }
}
