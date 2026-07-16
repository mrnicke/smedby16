const configuredOrigin = Deno.env.get('PUBLIC_SITE_URL')?.replace(/\/$/, '');
const allowedOrigins = new Set([
  configuredOrigin,
  'http://127.0.0.1:4321',
  'http://localhost:4321',
].filter((origin): origin is string => Boolean(origin)));

export function isAllowedOrigin(origin: string | null) {
  return origin === null || allowedOrigins.has(origin.replace(/\/$/, ''));
}

export function corsHeaders(request: Request, methods: readonly string[] = ['GET', 'POST']) {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-timestamp, x-webhook-signature',
    'Access-Control-Allow-Methods': [...methods, 'OPTIONS'].join(', '),
    'Vary': 'Origin',
  };
  if (origin && isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin.replace(/\/$/, '');
  return headers;
}

export function preflightResponse(request: Request, methods: readonly string[]) {
  if (request.method !== 'OPTIONS') return null;
  if (!isAllowedOrigin(request.headers.get('origin'))) return new Response(null, { status: 403, headers: { Vary: 'Origin' } });
  return new Response(null, { status: 204, headers: { ...corsHeaders(request, methods), Allow: [...methods, 'OPTIONS'].join(', ') } });
}

export function json(request: Request, body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...Object.fromEntries(new Headers(extraHeaders)) },
  });
}
