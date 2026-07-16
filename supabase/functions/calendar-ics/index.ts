import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { enforceMethod, handlePreflight } from '../_shared/http.ts';
import { buildCalendarIcs } from '../_shared/calendar-ics.ts';

Deno.serve(async (request) => {
  const preflight = handlePreflight(request, ['GET']); if (preflight) return preflight;
  const methodError = enforceMethod(request, ['GET']); if (methodError) return methodError;
  const url = Deno.env.get('SUPABASE_URL')!; const key = Deno.env.get('SUPABASE_ANON_KEY')!;
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.from('public_calendar_events').select('*').order('starts_at');
  if (error) return new Response('Kalendern kunde inte hämtas.', { status: 503, headers: corsHeaders(request) });
  const body = buildCalendarIcs((data ?? []).map((event) => ({ id:event.id,title:event.title,description:event.description,startsAt:event.starts_at,endsAt:event.ends_at,allDay:event.all_day,location:event.location,url:event.external_url })));
  return new Response(body, { headers: { ...corsHeaders(request), 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="smedby16.ics"', 'Cache-Control': 'public, max-age=300' } });
});
