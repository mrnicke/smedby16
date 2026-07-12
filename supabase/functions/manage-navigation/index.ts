import { z } from 'npm:zod@4';
import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';

const inputSchema = z.object({ id: z.string().uuid(), action: z.literal('delete') });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Metoden stöds inte.' }, 405);
  try {
    const { service } = await requireAdmin(request);
    const { id } = inputSchema.parse(await request.json());
    const { error } = await service.from('navigation_items').delete().eq('id', id);
    if (error) throw error;
    return json(request, { data: { id, deleted: true } });
  } catch (error) {
    if (error instanceof Response) return new Response(await error.text(), { status: error.status, headers: corsHeaders(request) });
    if (error instanceof z.ZodError) return json(request, { error: 'Ogiltig begäran.' }, 400);
    return json(request, { error: 'Navigationslänken kunde inte tas bort.' }, 500);
  }
});
