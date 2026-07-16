import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@4';
import { json } from '../_shared/cors.ts';
import { enforceMethod, handlePreflight, parseJsonText, passthroughError, readJsonText } from '../_shared/http.ts';
import { verifyWebhookSignature } from '../_shared/webhook.ts';

const schema = z.object({ deploymentId: z.union([z.string().uuid(),z.literal('')]).optional(), triggerType: z.enum(['nightly','manual','code']).default('code'), status: z.enum(['in_progress','success','failed']), runId: z.number().int().positive().optional(), errorSummary: z.string().max(500).optional() });
Deno.serve(async (request) => {
  const preflight = handlePreflight(request, ['POST']); if (preflight) return preflight;
  const methodError = enforceMethod(request, ['POST']); if (methodError) return methodError;
  try {
    const raw = await readJsonText(request, 16_384);
    const secret = Deno.env.get('DEPLOYMENT_WEBHOOK_SECRET');
    const url = Deno.env.get('SUPABASE_URL'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!secret || !url || !serviceKey) return json(request, { error: 'Serverkonfiguration saknas.' }, 503);
    const nonce = await verifyWebhookSignature(request, raw, secret);
    if (!nonce) return json(request, { error: 'Ogiltig signatur.' }, 401);
    const input = parseJsonText(raw, schema);
    const service = createClient(url, serviceKey, { auth: { persistSession: false } });
    await service.from('security_webhook_nonces').delete().lt('received_at',new Date(Date.now()-10*60_000).toISOString());
    const { error: nonceError } = await service.from('security_webhook_nonces').insert({ purpose:'deployment_status', signature_hash:nonce });
    if (nonceError) return json(request, { error: 'Begäran har redan behandlats.' }, 409);
    const completed = ['success','failed'].includes(input.status) ? new Date().toISOString() : null;
    const mutation = { status: input.status, external_run_id: input.runId, error_summary: input.errorSummary, completed_at: completed };
    const { error } = input.deploymentId ? await service.from('snapshot_deployments').update(mutation).eq('id', input.deploymentId) : await service.from('snapshot_deployments').insert({ ...mutation, trigger_type: input.triggerType });
    if (error) throw error;
    return json(request, { ok: true });
  } catch (error) { if (error instanceof Response) return passthroughError(request, error); return json(request, { error: 'Status kunde inte uppdateras.' }, 400); }
});
