import { z } from 'npm:zod@4';
import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';

const inputSchema = z.object({ revisionId: z.string().uuid() });
const allowed = new Set(['pages','news_posts','calendar_events','documents','media_assets','navigation_items','site_settings']);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  try {
    const { service, user } = await requireAdmin(request);
    const { revisionId } = inputSchema.parse(await request.json());
    const { data: revision, error } = await service.from('content_revisions').select('*').eq('id', revisionId).single();
    if (error || !revision || !allowed.has(revision.entity_type)) return json(request, { error: 'Revisionen kunde inte hittas.' }, 404);
    const restored = { ...revision.snapshot, updated_by: user.id, restored_from_id: undefined };
    delete restored.created_at; delete restored.updated_at;
    const { data, error: updateError } = await service.from(revision.entity_type).update(restored).eq('id', revision.entity_id).select().single();
    if (updateError) throw updateError;
    const { data: newest } = await service.from('content_revisions').select('id').eq('entity_type', revision.entity_type).eq('entity_id', revision.entity_id).order('revision_no', { ascending: false }).limit(1).single();
    if (newest) await service.from('content_revisions').update({ restored_from_id: revision.id }).eq('id', newest.id);
    return json(request, { data });
  } catch (error) {
    if (error instanceof Response) return new Response(await error.text(), { status: error.status, headers: corsHeaders(request) });
    return json(request, { error: 'Revisionen kunde inte återställas.' }, 500);
  }
});
