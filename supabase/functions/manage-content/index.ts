import { z } from 'npm:zod@4';
import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';

const inputSchema = z.object({
  entity: z.enum(['news_posts', 'calendar_events', 'documents']),
  id: z.string().uuid(),
  action: z.enum(['archive', 'restore', 'delete']),
});
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Metoden stöds inte.' }, 405);
  try {
    const { service, user } = await requireAdmin(request);
    const { entity, id, action } = inputSchema.parse(await request.json());
    const { data: current, error: readError } = await service.from(entity).select('id,archived_at').eq('id', id).maybeSingle();
    if (readError) throw readError;
    if (!current) return json(request, { error: 'Innehållet kunde inte hittas.' }, 404);

    if (action === 'delete') {
      if (!current.archived_at) return json(request, { error: 'Arkivera innehållet innan det tas bort permanent.' }, 409);
      const { error } = await service.from(entity).delete().eq('id', id);
      if (error) throw error;
      return json(request, { data: { id, deleted: true } });
    }

    const mutation = action === 'archive'
      ? { archived_at: new Date().toISOString(), is_published: false, updated_by: user.id }
      : { archived_at: null, is_published: false, updated_by: user.id };
    const { data, error } = await service.from(entity).update(mutation).eq('id', id).select().single();
    if (error) throw error;
    return json(request, { data });
  } catch (error) {
    if (error instanceof Response) return new Response(await error.text(), { status: error.status, headers: corsHeaders(request) });
    if (error instanceof z.ZodError) return json(request, { error: 'Ogiltig begäran.' }, 400);
    console.error('manage-content failed', error instanceof Error ? error.message : 'unknown');
    return json(request, { error: 'Åtgärden kunde inte genomföras.' }, 500);
  }
});
