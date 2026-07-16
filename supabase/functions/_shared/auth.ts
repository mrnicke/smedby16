import { createClient } from 'npm:@supabase/supabase-js@2';

export type Capability =
  | 'edit_pages' | 'publish_pages' | 'edit_news' | 'publish_news'
  | 'manage_media' | 'manage_navigation' | 'manage_calendar' | 'manage_documents'
  | 'manage_settings' | 'manage_revisions' | 'trigger_deploy'
  | 'manage_templates' | 'manage_components' | 'manage_global_layouts'
  | 'manage_design_system' | 'manage_admin_users' | 'override_expired_locks';

const editorCapabilities = new Set<Capability>(['edit_pages', 'publish_pages', 'edit_news', 'publish_news']);

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    return JSON.parse(atob(normalized)) as Record<string, unknown>;
  } catch { return null; }
}

export function tokenHasAal2(token: string) {
  return decodeJwtPayload(token)?.aal === 'aal2';
}

export async function requireAdmin(request: Request, options: { requireAal2?: boolean } = {}) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Response('Inte inloggad.', { status: 401 });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Response('Serverkonfiguration saknas.', { status: 500 });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = authorization.slice(7);
  const { data: userData, error: userError } = await service.auth.getUser(token);
  if (userError || !userData.user) throw new Response('Sessionen är inte giltig.', { status: 401 });
  const { data: profile } = await service.from('admin_profiles').select('active,role').eq('user_id', userData.user.id).maybeSingle();
  if (!profile?.active) throw new Response('Du saknar administratörsbehörighet.', { status: 403 });
  if (options.requireAal2 && !tokenHasAal2(token)) throw new Response('Tvåfaktorsautentisering krävs för den här åtgärden.', { status: 403 });
  return { service, user: userData.user, role: (profile.role ?? 'admin') as 'editor' | 'admin' };
}

export async function requireCapability(request: Request, capability: Capability, options: { requireAal2?: boolean } = { requireAal2: true }) {
  const context = await requireAdmin(request, options);
  if (context.role !== 'admin' && !editorCapabilities.has(capability)) throw new Response('Du saknar behörighet för den här åtgärden.', { status: 403 });
  return context;
}
