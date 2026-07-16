import { z } from 'npm:zod@4';
import { json } from '../_shared/cors.ts';
import { requireCapability } from '../_shared/auth.ts';
import { enforceMethod, handlePreflight, parseJson, passthroughError } from '../_shared/http.ts';
import { migrateLegacyBlocks } from '../_shared/cms-schema.ts';

const inputSchema = z.object({ revisionId: z.string().uuid() });
const allowed = new Set(['pages','news_posts','calendar_events','documents','media_assets','navigation_items','site_settings']);

Deno.serve(async (request) => {
  const preflight = handlePreflight(request, ['POST']); if (preflight) return preflight;
  const methodError = enforceMethod(request, ['POST']); if (methodError) return methodError;
  try {
    const { revisionId } = await parseJson(request, inputSchema);
    const { service, user } = await requireCapability(request, 'manage_revisions');
    const { data: revision, error } = await service.from('content_revisions').select('*').eq('id', revisionId).single();
    if (error || !revision || !allowed.has(revision.entity_type)) return json(request, { error: 'Revisionen kunde inte hittas.' }, 404);
    if (revision.entity_type === 'pages' || revision.entity_type === 'news_posts') {
      const entityType = revision.entity_type === 'pages' ? 'page' : 'news';
      const legacyBlocks = revision.entity_type === 'pages' ? revision.snapshot.blocks : revision.snapshot.body_blocks;
      const document = revision.snapshot.editor_version === 2 && revision.snapshot.editor_document ? revision.snapshot.editor_document : migrateLegacyBlocks(legacyBlocks ?? [], revision.entity_id);
      const { data: current } = await service.from(revision.entity_type).select('published_version').eq('id', revision.entity_id).single();
      const { data: existing } = await service.from('content_drafts').select('draft_version').eq('entity_type', entityType).eq('entity_id', revision.entity_id).maybeSingle();
      const { data, error: draftError } = await service.from('content_drafts').upsert({ entity_type: entityType, entity_id: revision.entity_id, snapshot: document, draft_version: (existing?.draft_version ?? 0) + 1, base_published_version: current?.published_version ?? 1, updated_by: user.id }, { onConflict: 'entity_type,entity_id' }).select().single();
      if (draftError) throw draftError;
      return json(request, { data, message: 'Revisionen har lagts som ett nytt utkast för granskning.' });
    }
    const restored = { ...revision.snapshot, updated_by: user.id, restored_from_id: undefined };
    delete restored.created_at; delete restored.updated_at;
    const { data, error: updateError } = await service.from(revision.entity_type).update(restored).eq('id', revision.entity_id).select().single();
    if (updateError) throw updateError;
    const { data: newest } = await service.from('content_revisions').select('id').eq('entity_type', revision.entity_type).eq('entity_id', revision.entity_id).order('revision_no', { ascending: false }).limit(1).single();
    if (newest) await service.from('content_revisions').update({ restored_from_id: revision.id }).eq('id', newest.id);
    return json(request, { data });
  } catch (error) {
    if (error instanceof Response) return passthroughError(request, error);
    return json(request, { error: 'Revisionen kunde inte återställas.' }, 500);
  }
});
