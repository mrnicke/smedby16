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
  const { data: profile } = await service.from('admin_profiles').select('active').eq('user_id', userData.user.id).maybeSingle();
  if (!profile?.active) throw new Response('Du saknar administratörsbehörighet.', { status: 403 });
  return { service, user: userData.user };
}
