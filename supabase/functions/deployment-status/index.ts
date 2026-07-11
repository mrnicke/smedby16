import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@4';
import { corsHeaders, json } from '../_shared/cors.ts';

const schema = z.object({ deploymentId: z.union([z.string().uuid(),z.literal('')]).optional(), triggerType: z.enum(['nightly','manual','code']).default('code'), status: z.enum(['in_progress','success','failed']), runId: z.number().int().positive().optional(), errorSummary: z.string().max(500).optional() });
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.headers.get('x-deployment-secret') !== Deno.env.get('DEPLOYMENT_WEBHOOK_SECRET')) return json(request, { error: 'Ogiltig signatur.' }, 401);
  try {
    const input = schema.parse(await request.json());
    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const completed = ['success','failed'].includes(input.status) ? new Date().toISOString() : null;
    const mutation = { status: input.status, external_run_id: input.runId, error_summary: input.errorSummary, completed_at: completed };
    const { error } = input.deploymentId ? await service.from('snapshot_deployments').update(mutation).eq('id', input.deploymentId) : await service.from('snapshot_deployments').insert({ ...mutation, trigger_type: input.triggerType });
    if (error) throw error;
    return json(request, { ok: true });
  } catch { return json(request, { error: 'Status kunde inte uppdateras.' }, 400); }
});
