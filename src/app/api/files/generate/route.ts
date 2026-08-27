// ─── /api/files/generate — turn a filegen payload into a real file ──────────
// Returns base64 + filename; the browser triggers download.

import { NextRequest } from 'next/server';
import { generateFile } from '@/lib/server/filegen';
import type { FileFormat } from '@/lib/types';

export const runtime = 'nodejs';

const VALID: FileFormat[] = ['invoice', 'quotation', 'estimate', 'xlsx', 'pptx'];

export async function POST(req: NextRequest) {
  let body: { format?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const format = body.format as FileFormat;
  if (!format || !VALID.includes(format)) {
    return Response.json({ error: `format must be one of ${VALID.join(', ')}` }, { status: 400 });
  }
  if (!body.payload || typeof body.payload !== 'object') {
    return Response.json({ error: 'payload object is required' }, { status: 400 });
  }
  try {
    const file = await generateFile(format, body.payload);
    return Response.json(file);
  } catch (e) {
    return Response.json({ error: `Generation failed: ${(e as Error).message}` }, { status: 500 });
  }
}
