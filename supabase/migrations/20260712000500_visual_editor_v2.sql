-- Additive foundation for the versioned visual editor. Apply only after a verified backup.
alter table public.admin_profiles add column role text;
update public.admin_profiles set role = 'admin' where role is null;
alter table public.admin_profiles alter column role set default 'editor';
alter table public.admin_profiles alter column role set not null;
alter table public.admin_profiles add constraint admin_profiles_role_check check (role in ('editor','admin'));

alter table public.pages add column editor_version smallint not null default 1 check (editor_version in (1,2));
alter table public.pages add column editor_document jsonb check (editor_document is null or jsonb_typeof(editor_document) = 'object');
alter table public.pages add column published_version integer not null default 1 check (published_version > 0);
alter table public.pages add column archived_at timestamptz;
alter table public.news_posts add column editor_version smallint not null default 1 check (editor_version in (1,2));
alter table public.news_posts add column editor_document jsonb check (editor_document is null or jsonb_typeof(editor_document) = 'object');
alter table public.news_posts add column published_version integer not null default 1 check (published_version > 0);

create type public.editor_entity_type as enum ('page','news','component','global_layout');
create type public.publication_action as enum ('publish','unpublish');

create table public.content_drafts (
  id uuid primary key default gen_random_uuid(), entity_type public.editor_entity_type not null, entity_id uuid not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'), draft_version integer not null default 1 check (draft_version > 0),
  base_published_version integer not null check (base_published_version > 0), updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(entity_type, entity_id)
);
create table public.content_locks (
  entity_type public.editor_entity_type not null, entity_id uuid not null, user_id uuid not null references auth.users(id), lock_token uuid not null default gen_random_uuid(),
  acquired_at timestamptz not null default now(), heartbeat_at timestamptz not null default now(), expires_at timestamptz not null default (now() + interval '2 minutes'),
  primary key(entity_type, entity_id), unique(lock_token), check(expires_at > acquired_at)
);
create table public.editor_templates (
  id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 1 and 120), description text not null default '' check(char_length(description)<=500),
  template_type text not null check(template_type in ('page','news')), editor_document jsonb not null check(jsonb_typeof(editor_document)='object'),
  thumbnail_media_id uuid references public.media_assets(id) on delete set null, locked_node_ids uuid[] not null default '{}', editable_fields jsonb not null default '{}'::jsonb,
  active boolean not null default true, archived_at timestamptz, created_by uuid references auth.users(id), updated_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reusable_components (
  id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 1 and 120), component_type text not null,
  published_definition jsonb not null check(jsonb_typeof(published_definition)='object'), allowed_instance_properties jsonb not null default '{}'::jsonb,
  version integer not null default 1 check(version > 0), is_published boolean not null default false, archived_at timestamptz,
  created_by uuid references auth.users(id), updated_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.global_layouts (
  id uuid primary key default gen_random_uuid(), layout_type text not null unique check(layout_type in ('header','navigation','footer','design_system')),
  editor_document jsonb not null check(jsonb_typeof(editor_document)='object'), version integer not null default 1 check(version > 0), is_published boolean not null default false,
  created_by uuid references auth.users(id), updated_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.scheduled_publications (
  id uuid primary key default gen_random_uuid(), entity_type public.editor_entity_type not null, entity_id uuid not null, action public.publication_action not null,
  execute_at timestamptz not null, status text not null default 'pending' check(status in ('pending','processing','completed','failed','cancelled')),
  attempts integer not null default 0 check(attempts>=0), processed_at timestamptz, error_summary text check(char_length(error_summary)<=500), requested_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id, action)
);
create unique index scheduled_publications_pending_once on public.scheduled_publications(entity_type,entity_id,action,execute_at) where status in ('pending','processing');
create table public.content_redirects (
  id uuid primary key default gen_random_uuid(), old_path text not null unique check(old_path like '/%'), new_path text not null check(new_path like '/%' and new_path not like '//%'),
  active boolean not null default true, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(old_path<>new_path)
);

create or replace function public.current_admin_role() returns text language sql stable security definer set search_path=public as $$
  select role from public.admin_profiles where user_id=auth.uid() and active limit 1
$$;
create or replace function public.has_admin_capability(capability text) returns boolean language sql stable security definer set search_path=public as $$
  select case public.current_admin_role()
    when 'admin' then capability = any(array['edit_pages','publish_pages','edit_news','publish_news','manage_templates','manage_components','manage_global_layouts','manage_design_system','manage_admin_users','override_expired_locks'])
    when 'editor' then capability = any(array['edit_pages','publish_pages','edit_news','publish_news']) else false end
$$;
revoke all on function public.current_admin_role(), public.has_admin_capability(text) from public;
grant execute on function public.current_admin_role() to anon, authenticated, service_role;
grant execute on function public.has_admin_capability(text) to authenticated, service_role;

alter table public.content_drafts enable row level security; alter table public.content_locks enable row level security; alter table public.editor_templates enable row level security;
alter table public.reusable_components enable row level security; alter table public.global_layouts enable row level security; alter table public.scheduled_publications enable row level security; alter table public.content_redirects enable row level security;
create policy editor_drafts_read on public.content_drafts for select to authenticated using (updated_by=auth.uid() or public.current_admin_role()='admin');
create policy editor_drafts_insert on public.content_drafts for insert to authenticated with check (updated_by=auth.uid() and ((entity_type='page' and public.has_admin_capability('edit_pages')) or (entity_type='news' and public.has_admin_capability('edit_news'))));
create policy editor_drafts_update on public.content_drafts for update to authenticated using (updated_by=auth.uid() or public.current_admin_role()='admin') with check (updated_by=auth.uid());
create policy editor_locks_read on public.content_locks for select to authenticated using (public.is_active_admin());
create policy editor_locks_insert on public.content_locks for insert to authenticated with check (user_id=auth.uid() and public.is_active_admin());
create policy editor_locks_update on public.content_locks for update to authenticated using (user_id=auth.uid() or (expires_at<now() and public.has_admin_capability('override_expired_locks'))) with check (user_id=auth.uid());
create policy editor_locks_delete on public.content_locks for delete to authenticated using (user_id=auth.uid() or (expires_at<now() and public.has_admin_capability('override_expired_locks')));
create policy active_templates_read on public.editor_templates for select to authenticated using (public.is_active_admin() and (active or public.current_admin_role()='admin'));
create policy published_components_read on public.reusable_components for select to authenticated using ((is_published and archived_at is null) or public.current_admin_role()='admin');
create policy public_components_read on public.reusable_components for select to anon using (is_published and archived_at is null);
create policy public_global_layouts_read on public.global_layouts for select to anon,authenticated using (is_published or public.current_admin_role()='admin');
create policy own_schedules_read on public.scheduled_publications for select to authenticated using (requested_by=auth.uid() or public.current_admin_role()='admin');
create policy public_redirects_read on public.content_redirects for select to anon,authenticated using (active or public.current_admin_role()='admin');

do $$ declare table_name text; begin foreach table_name in array array['content_drafts','editor_templates','reusable_components','global_layouts','scheduled_publications','content_redirects'] loop execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', table_name||'_touch',table_name); end loop; end $$;
create trigger editor_templates_revision after insert or update on public.editor_templates for each row execute function public.record_content_revision();
create trigger reusable_components_revision after insert or update on public.reusable_components for each row execute function public.record_content_revision();
create trigger global_layouts_revision after insert or update on public.global_layouts for each row execute function public.record_content_revision();

create or replace view public.public_pages with (security_invoker=true) as select id,page_key,slug,template,title,seo_title,seo_description,social_media_id,blocks,is_published,updated_at,editor_version,editor_document,published_version from public.pages where is_published and archived_at is null;
create or replace view public.public_news_posts with (security_invoker=true) as select id,slug,title,summary,body_blocks,hero_media_id,published_at,updated_at,editor_version,editor_document,published_version from public.news_posts where is_published and archived_at is null;
grant select on public.public_pages, public.public_news_posts to anon,authenticated;
grant select,insert,update,delete on public.content_drafts,public.content_locks,public.editor_templates,public.reusable_components,public.global_layouts,public.scheduled_publications,public.content_redirects to service_role;
grant select,insert,update,delete on public.content_drafts,public.content_locks to authenticated;
grant select on public.editor_templates,public.reusable_components,public.global_layouts,public.scheduled_publications,public.content_redirects to authenticated;
grant select on public.reusable_components,public.global_layouts,public.content_redirects to anon;

create or replace function public.update_page_settings_with_redirect(
  p_entity_id uuid,
  p_expected_version integer,
  p_title text,
  p_slug text,
  p_seo_title text,
  p_seo_description text,
  p_social_media_id uuid,
  p_actor uuid
) returns public.pages
language plpgsql
security definer
set search_path = public
as $$
declare
  current_page public.pages;
  saved_page public.pages;
begin
  select * into current_page from public.pages where id = p_entity_id for update;
  if not found then raise exception 'page_not_found' using errcode = 'P0002'; end if;
  if current_page.published_version <> p_expected_version then raise exception 'version_conflict' using errcode = '40001'; end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 160 then raise exception 'invalid_title' using errcode = '22023'; end if;
  if p_slug is null or not (p_slug ~ '^/([a-z0-9-]+/)*$' or p_slug = '/') then raise exception 'invalid_slug' using errcode = '22023'; end if;
  if p_slug in ('/admin/','/kalender.ics/') then raise exception 'reserved_slug' using errcode = '22023'; end if;
  if exists(select 1 from public.pages where slug = p_slug and id <> p_entity_id) then raise exception 'slug_in_use' using errcode = '23505'; end if;
  if current_page.slug <> p_slug and exists(select 1 from public.content_redirects where old_path = p_slug and active) then raise exception 'redirect_source_in_use' using errcode = '23505'; end if;

  update public.pages set
    title = trim(p_title), slug = p_slug, seo_title = nullif(trim(p_seo_title), ''),
    seo_description = nullif(trim(p_seo_description), ''), social_media_id = p_social_media_id,
    published_version = published_version + 1, updated_by = p_actor
  where id = p_entity_id
  returning * into saved_page;

  if current_page.slug <> p_slug then
    update public.content_redirects set new_path = p_slug where new_path = current_page.slug and active;
    insert into public.content_redirects(old_path,new_path,active,created_by)
      values(current_page.slug,p_slug,true,p_actor)
      on conflict(old_path) do update set new_path=excluded.new_path,active=true,updated_at=now();
  end if;
  return saved_page;
end $$;
revoke all on function public.update_page_settings_with_redirect(uuid,integer,text,text,text,text,uuid,uuid) from public;
grant execute on function public.update_page_settings_with_redirect(uuid,integer,text,text,text,text,uuid,uuid) to service_role;
