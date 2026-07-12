import { z } from 'npm:zod@4';
import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';

const inputSchema = z.object({ id: z.string().uuid(), action: z.enum(['usage', 'delete']) });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Metoden stöds inte.' }, 405);
  try {
    const { service, user } = await requireAdmin(request);
    const { id, action } = inputSchema.parse(await request.json());
    const { data: asset, error: assetError } = await service.from('media_assets').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (assetError) throw assetError;
    if (!asset) return json(request, { error: 'Filen kunde inte hittas.' }, 404);
    const { data: usageRows, error: usageError } = await service.rpc('media_asset_references', { target_id: id });
    if (usageError) throw usageError;
    const references = (usageRows ?? []).filter((row: { reference_count: number | string }) => Number(row.reference_count) > 0);
    if (action === 'usage') return json(request, { data: { references } });
    if (references.length) return json(request, { error: 'Filen används fortfarande och kan inte tas bort.', references }, 409);

    const { error: markError } = await service.from('media_assets').update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq('id', id);
    if (markError) throw markError;
    const { error: storageError } = await service.storage.from('public-media').remove([asset.storage_path]);
    if (storageError) {
      await service.from('media_assets').update({ deleted_at: null, updated_by: user.id }).eq('id', id);
      throw storageError;
    }
    return json(request, { data: { id, deleted: true } });
  } catch (error) {
    if (error instanceof Response) return new Response(await error.text(), { status: error.status, headers: corsHeaders(request) });
    if (error instanceof z.ZodError) return json(request, { error: 'Ogiltig begäran.' }, 400);
    console.error('manage-media failed', error instanceof Error ? error.message : 'unknown');
    return json(request, { error: 'Filen kunde inte hanteras.' }, 500);
  }
});
