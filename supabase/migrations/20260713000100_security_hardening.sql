-- Apply only after a verified backup and review of docs/security-hardening.md.
-- This migration is never applied by the repository build.

create or replace function public.current_authentication_assurance_level()
returns text language sql stable set search_path = pg_catalog
as $$ select coalesce((select auth.jwt()->>'aal'), 'aal1') $$;

create or replace function public.is_aal2()
returns boolean language sql stable set search_path = pg_catalog
as $$ select public.current_authentication_assurance_level() = 'aal2' $$;

revoke all on function public.current_authentication_assurance_level(), public.is_aal2() from public;
grant execute on function public.current_authentication_assurance_level(), public.is_aal2() to authenticated, service_role;

create or replace function public.has_admin_capability(capability text)
returns boolean language sql stable security definer set search_path = public, pg_catalog as $$
  select case public.current_admin_role()
    when 'admin' then capability = any(array[
      'edit_pages','publish_pages','edit_news','publish_news','manage_media',
      'manage_navigation','manage_calendar','manage_documents','manage_settings',
      'manage_revisions','trigger_deploy','manage_templates','manage_components',
      'manage_global_layouts','manage_design_system','manage_admin_users','override_expired_locks'
    ])
    when 'editor' then capability = any(array['edit_pages','publish_pages','edit_news','publish_news'])
    else false end
$$;

create table public.security_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action ~ '^[a-z0-9_.-]{1,80}$'),
  target_type text check (target_type is null or target_type ~ '^[a-z0-9_.-]{1,80}$'),
  target_id uuid,
  outcome text not null check (outcome in ('success','denied','failed')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096)
);
alter table public.security_audit_log enable row level security;
create policy security_audit_admin_read on public.security_audit_log for select to authenticated
  using (public.is_aal2() and public.has_admin_capability('manage_revisions'));
grant select on public.security_audit_log to authenticated;
grant select, insert on public.security_audit_log to service_role;

create table public.security_webhook_nonces (
  signature_hash text primary key check (signature_hash ~ '^[0-9a-f]{64}$'),
  purpose text not null check (purpose in ('deployment_status','scheduled_publications')),
  received_at timestamptz not null default now()
);
create index security_webhook_nonces_received_at_idx on public.security_webhook_nonces(received_at);
alter table public.security_webhook_nonces enable row level security;
grant select, insert, delete on public.security_webhook_nonces to service_role;

create or replace function public.first_admin_claim_available()
returns boolean language sql stable security definer set search_path = public, pg_catalog as $$
  select auth.uid() is not null and not exists(select 1 from public.admin_profiles where active)
$$;
revoke all on function public.first_admin_claim_available() from public;
grant execute on function public.first_admin_claim_available() to authenticated;

create or replace function public.claim_first_admin(display_name text)
returns public.admin_profiles language plpgsql security definer set search_path = public, pg_catalog as $$
declare claimed public.admin_profiles;
begin
  if auth.uid() is null or not public.is_aal2() then raise exception 'aal2_required' using errcode = '42501'; end if;
  if display_name is null or char_length(trim(display_name)) not between 1 and 120 then raise exception 'invalid_display_name' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('smedby16'), hashtext('claim_first_admin'));
  if exists(select 1 from public.admin_profiles where active) then raise exception 'admin_already_exists' using errcode = '42501'; end if;
  if exists(select 1 from public.admin_profiles where user_id = auth.uid()) then raise exception 'profile_already_exists' using errcode = '42501'; end if;
  insert into public.admin_profiles(user_id,display_name,active,role)
    values(auth.uid(),trim(display_name),true,'admin') returning * into claimed;
  insert into public.security_audit_log(actor_id,action,target_type,target_id,outcome)
    values(auth.uid(),'admin.first_claim','admin_profile',auth.uid(),'success');
  return claimed;
end $$;
revoke all on function public.claim_first_admin(text) from public;
grant execute on function public.claim_first_admin(text) to authenticated;

create or replace function public.apply_scheduled_publication(
  p_job_id uuid,
  p_expected_published_version integer,
  p_expected_draft_version integer default null
)
returns public.scheduled_publications
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  job public.scheduled_publications;
  draft public.content_drafts;
  completed public.scheduled_publications;
  affected integer;
begin
  select * into job from public.scheduled_publications where id = p_job_id for update;
  if not found or job.status <> 'processing' then raise exception 'schedule_not_processing' using errcode = '55000'; end if;
  if job.entity_type not in ('page','news') then raise exception 'unsupported_entity_type' using errcode = '22023'; end if;
  if exists(
    select 1 from public.content_locks
    where entity_type = job.entity_type and entity_id = job.entity_id and expires_at > now()
  ) then raise exception 'active_editor_lock' using errcode = '55P03'; end if;

  if job.action = 'publish' then
    if p_expected_draft_version is null then raise exception 'draft_version_required' using errcode = '22023'; end if;
    select * into draft from public.content_drafts
    where entity_type = job.entity_type and entity_id = job.entity_id
    for update;
    if not found or draft.draft_version <> p_expected_draft_version or draft.base_published_version <> p_expected_published_version then
      raise exception 'publication_version_conflict' using errcode = '40001';
    end if;

    if job.entity_type = 'page' then
      update public.pages set editor_version=2,editor_document=draft.snapshot,published_version=published_version+1,is_published=true,archived_at=null,updated_by=job.requested_by
      where id=job.entity_id and published_version=p_expected_published_version;
    else
      update public.news_posts set editor_version=2,editor_document=draft.snapshot,published_version=published_version+1,is_published=true,archived_at=null,updated_by=job.requested_by
      where id=job.entity_id and published_version=p_expected_published_version;
    end if;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'publication_version_conflict' using errcode = '40001'; end if;
    delete from public.content_drafts where id = draft.id;
  else
    if job.entity_type = 'page' then
      update public.pages set is_published=false,published_version=published_version+1,updated_by=job.requested_by
      where id=job.entity_id and published_version=p_expected_published_version;
    else
      update public.news_posts set is_published=false,published_version=published_version+1,updated_by=job.requested_by
      where id=job.entity_id and published_version=p_expected_published_version;
    end if;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'publication_version_conflict' using errcode = '40001'; end if;
  end if;

  update public.scheduled_publications set status='completed',processed_at=now(),error_summary=null
  where id=job.id returning * into completed;
  return completed;
end $$;
revoke all on function public.apply_scheduled_publication(uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.apply_scheduled_publication(uuid,integer,integer) to service_role;

drop policy if exists editor_drafts_insert on public.content_drafts;
drop policy if exists editor_drafts_update on public.content_drafts;
drop policy if exists editor_locks_insert on public.content_locks;
drop policy if exists editor_locks_update on public.content_locks;
drop policy if exists editor_locks_delete on public.content_locks;
create policy editor_drafts_insert on public.content_drafts for insert to authenticated
  with check (public.is_aal2() and updated_by=auth.uid() and ((entity_type='page' and public.has_admin_capability('edit_pages')) or (entity_type='news' and public.has_admin_capability('edit_news'))));
create policy editor_drafts_update on public.content_drafts for update to authenticated
  using (public.is_aal2() and (updated_by=auth.uid() or public.current_admin_role()='admin')) with check (public.is_aal2() and updated_by=auth.uid());
create policy editor_locks_insert on public.content_locks for insert to authenticated
  with check (public.is_aal2() and user_id=auth.uid() and public.is_active_admin());
create policy editor_locks_update on public.content_locks for update to authenticated
  using (public.is_aal2() and (user_id=auth.uid() or (expires_at<now() and public.has_admin_capability('override_expired_locks')))) with check (public.is_aal2() and user_id=auth.uid());
create policy editor_locks_delete on public.content_locks for delete to authenticated
  using (public.is_aal2() and (user_id=auth.uid() or (expires_at<now() and public.has_admin_capability('override_expired_locks'))));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('media-quarantine','media-quarantine',false,26214400,array['application/octet-stream'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists admin_insert_media on storage.objects;
drop policy if exists admin_update_media on storage.objects;
drop policy if exists admin_delete_media on storage.objects;
create policy quarantine_own_insert on storage.objects for insert to authenticated
  with check (bucket_id='media-quarantine' and public.is_aal2() and public.has_admin_capability('manage_media') and (storage.foldername(name))[1]=auth.uid()::text);
create policy quarantine_own_read on storage.objects for select to authenticated
  using (bucket_id='media-quarantine' and public.is_aal2() and public.has_admin_capability('manage_media') and (storage.foldername(name))[1]=auth.uid()::text);
create policy quarantine_own_delete on storage.objects for delete to authenticated
  using (bucket_id='media-quarantine' and public.is_aal2() and public.has_admin_capability('manage_media') and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.search_public_content(search_query text, content_type text default null, result_limit integer default 20, result_offset integer default 0)
returns table(title text, href text, type text, excerpt text)
language sql stable security invoker set statement_timeout = '2s' as $$
  with entries as (
    select p.title, p.slug href, 'information'::text type, coalesce(p.seo_description,'') excerpt, p.title||' '||coalesce(p.seo_description,'')||' '||p.blocks::text searchable from public.pages p where p.is_published and p.archived_at is null
    union all select n.title, '/senaste-nytt/?nyhet='||n.slug, 'nyheter', n.summary, n.title||' '||n.summary||' '||n.body_blocks::text from public.news_posts n where n.is_published and n.archived_at is null
    union all select d.title, '/dokument/', 'dokument', d.description, d.title||' '||d.description||' '||d.category from public.documents d where d.is_published and d.archived_at is null
    union all select e.title, '/kalender/', 'kalender', e.description, e.title||' '||e.description||' '||coalesce(e.location,'') from public.calendar_events e where e.is_published and e.archived_at is null
  ) select title,href,type,excerpt from entries
  where char_length(trim(coalesce(search_query,''))) between 1 and 120
    and (content_type is null or content_type = any(array['information','nyheter','dokument','kalender']))
    and (content_type is null or entries.type=content_type)
    and to_tsvector('swedish',searchable) @@ plainto_tsquery('swedish',left(search_query,120))
  limit least(greatest(coalesce(result_limit,20),1),50)
  offset least(greatest(coalesce(result_offset,0),0),1000)
$$;
revoke all on function public.search_public_content(text,text,integer,integer) from public;
grant execute on function public.search_public_content(text,text,integer,integer) to anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
