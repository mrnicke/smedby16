import { z } from 'npm:zod@4';
import { json } from '../_shared/cors.ts';
import { requireCapability, type Capability } from '../_shared/auth.ts';
import { enforceMethod, handlePreflight, parseJson, passthroughError } from '../_shared/http.ts';

const inputSchema = z.object({
  entity: z.enum(['news_posts', 'calendar_events', 'documents']),
  id: z.string().uuid(),
  action: z.enum(['archive', 'restore', 'delete']),
});
Deno.serve(async (request) => {
  const preflight = handlePreflight(request, ['POST']); if (preflight) return preflight;
  const methodError = enforceMethod(request, ['POST']); if (methodError) return methodError;
  try {
    const { entity, id, action } = await parseJson(request, inputSchema);
    const capability: Capability = entity === 'news_posts' ? 'publish_news' : entity === 'calendar_events' ? 'manage_calendar' : 'manage_documents';
    const { service, user } = await requireCapability(request, capability);
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
    if (error instanceof Response) return passthroughError(request, error);
    if (error instanceof z.ZodError) return json(request, { error: 'Ogiltig begäran.' }, 400);
    console.error('manage-content failed', error instanceof Error ? error.message : 'unknown');
    return json(request, { error: 'Åtgärden kunde inte genomföras.' }, 500);
  }
});
