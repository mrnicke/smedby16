revoke all on function public.media_asset_references(uuid) from anon, authenticated;
revoke all on function public.record_content_revision() from anon, authenticated;
revoke all on function public.touch_updated_at() from anon, authenticated;
-- Supabase projects may grant EXECUTE on newly created public functions to API
-- roles by default. Future RPCs must be exposed explicitly in migrations.
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
