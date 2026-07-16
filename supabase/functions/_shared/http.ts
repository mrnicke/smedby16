import type { z } from 'npm:zod@4';
import { corsHeaders, json, preflightResponse } from './cors.ts';

const encoder = new TextEncoder();

export function handlePreflight(request: Request, methods: readonly string[]) {
  return preflightResponse(request, methods);
}

export function enforceMethod(request: Request, methods: readonly string[]) {
  if (methods.includes(request.method)) return null;
  return json(request, { error: 'Metoden stöds inte.' }, 405, { Allow: [...methods, 'OPTIONS'].join(', ') });
}

export async function readJsonText(request: Request, maxBytes = 65_536): Promise<string> {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') throw new Response('Content-Type måste vara application/json.', { status: 415 });
  const advertisedLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(advertisedLength) && advertisedLength > maxBytes) throw new Response('Begäran är för stor.', { status: 413 });
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > maxBytes) throw new Response('Begäran är för stor.', { status: 413 });
  return raw;
}

export function parseJsonText<T>(raw: string, schema: z.ZodType<T>): T {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Response('Ogiltig JSON.', { status: 400 }); }
  return schema.parse(value);
}

export async function parseJson<T>(request: Request, schema: z.ZodType<T>, maxBytes = 65_536): Promise<T> {
  return parseJsonText(await readJsonText(request, maxBytes), schema);
}

export async function passthroughError(request: Request, error: Response) {
  return new Response(await error.text(), {
    status: error.status,
    headers: { ...corsHeaders(request), 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
