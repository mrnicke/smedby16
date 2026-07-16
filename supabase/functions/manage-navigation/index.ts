import { z } from 'npm:zod@4';
import { json } from '../_shared/cors.ts';
import { requireCapability } from '../_shared/auth.ts';
import { enforceMethod, handlePreflight, parseJson, passthroughError } from '../_shared/http.ts';

const inputSchema = z.object({ id: z.string().uuid(), action: z.literal('delete') });

Deno.serve(async (request) => {
  const preflight = handlePreflight(request, ['POST']); if (preflight) return preflight;
  const methodError = enforceMethod(request, ['POST']); if (methodError) return methodError;
  try {
    const { id } = await parseJson(request, inputSchema);
    const { service } = await requireCapability(request, 'manage_navigation');
    const { error } = await service.from('navigation_items').delete().eq('id', id);
    if (error) throw error;
    return json(request, { data: { id, deleted: true } });
  } catch (error) {
    if (error instanceof Response) return passthroughError(request, error);
    if (error instanceof z.ZodError) return json(request, { error: 'Ogiltig begäran.' }, 400);
    return json(request, { error: 'Navigationslänken kunde inte tas bort.' }, 500);
  }
});
