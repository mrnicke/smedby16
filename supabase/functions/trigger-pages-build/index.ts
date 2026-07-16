import { json } from '../_shared/cors.ts';
import { requireCapability } from '../_shared/auth.ts';
import { enforceMethod, handlePreflight, passthroughError } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const preflight = handlePreflight(request, ['POST']); if (preflight) return preflight;
  const methodError = enforceMethod(request, ['POST']); if (methodError) return methodError;
  if (request.headers.get('content-length') && request.headers.get('content-length') !== '0') return json(request, { error: 'Begäran ska inte innehålla data.' }, 413);
  try {
    const { service, user } = await requireCapability(request, 'trigger_deploy');
    const owner = Deno.env.get('GITHUB_OWNER'); const repo = Deno.env.get('GITHUB_REPO'); const token = Deno.env.get('GITHUB_ACTIONS_TOKEN');
    if (!owner || !repo || !token) return json(request, { error: 'GitHub-integrationen är inte konfigurerad.' }, 503);
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await service.from('snapshot_deployments').select('*', { count: 'exact', head: true }).eq('requested_by', user.id).gte('started_at', since);
    if ((count ?? 0) >= 3) return json(request, { error: 'Vänta en stund innan du startar ett nytt bygge.' }, 429);
    const { data: deployment } = await service.from('snapshot_deployments').insert({ trigger_type: 'manual', status: 'queued', requested_by: user.id }).select().single();
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/deploy-pages.yml/dispatches`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, body: JSON.stringify({ ref: 'main', inputs: { deployment_id: deployment.id } }) });
    if (!response.ok) { await service.from('snapshot_deployments').update({ status: 'failed', completed_at: new Date().toISOString(), error_summary: `GitHub svarade med status ${response.status}.` }).eq('id', deployment.id); throw new Error(`GitHub ${response.status}`); }
    return json(request, { data: deployment }, 202);
  } catch (error) {
    if (error instanceof Response) return passthroughError(request, error);
    return json(request, { error: 'Bygget kunde inte startas.' }, 502);
  }
});
