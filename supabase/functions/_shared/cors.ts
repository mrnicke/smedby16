const configuredOrigin = Deno.env.get('PUBLIC_SITE_URL') ?? 'http://127.0.0.1:4321';
const allowedOrigins = new Set([configuredOrigin, 'http://127.0.0.1:4321', 'http://localhost:4321']);

export function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? configuredOrigin;
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : configuredOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-deployment-secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' } });
}
