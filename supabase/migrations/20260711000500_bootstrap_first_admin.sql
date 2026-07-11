insert into public.admin_profiles (user_id, display_name, active)
select
  id,
  coalesce(nullif(raw_user_meta_data ->> 'display_name', ''), 'Niklas'),
  true
from auth.users
where lower(email) = lower('mrnicke2@gmail.com')
on conflict (user_id) do update
set
  display_name = excluded.display_name,
  active = true,
  updated_at = now();
