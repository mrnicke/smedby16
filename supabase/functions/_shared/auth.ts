import { createClient } from 'npm:@supabase/supabase-js@2';

export async function requireAdmin(request: Request) {
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
  return { service, user: userData.user, role: (profile.role ?? 'admin') as 'editor' | 'admin' };
}

export type Capability = 'edit_pages'|'publish_pages'|'edit_news'|'publish_news'|'manage_templates'|'manage_components'|'manage_global_layouts'|'manage_design_system'|'manage_admin_users'|'override_expired_locks';
const editorCapabilities = new Set<Capability>(['edit_pages','publish_pages','edit_news','publish_news']);
export async function requireCapability(request: Request, capability: Capability) {
  const context = await requireAdmin(request);
  if (context.role !== 'admin' && !editorCapabilities.has(capability)) throw new Response('Du saknar behörighet för den här åtgärden.', { status: 403 });
  return context;
}
