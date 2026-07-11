-- Published-content RLS policies evaluate this helper for both anon and
-- authenticated roles. Anonymous callers always receive false because
-- auth.uid() is null; granting EXECUTE does not grant table access.
grant execute on function public.is_active_admin() to anon;
