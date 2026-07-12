alter table public.news_posts add column archived_at timestamptz;
alter table public.calendar_events add column archived_at timestamptz;
alter table public.documents add column archived_at timestamptz;

create index news_posts_archived_at_idx on public.news_posts(archived_at);
create index calendar_events_archived_at_idx on public.calendar_events(archived_at);
create index documents_archived_at_idx on public.documents(archived_at);

create or replace view public.public_news_posts with (security_invoker=true) as
  select id,slug,title,summary,body_blocks,hero_media_id,published_at,updated_at
  from public.news_posts where is_published and archived_at is null;

create or replace view public.public_calendar_events with (security_invoker=true) as
  select id,title,description,starts_at,ends_at,all_day,location,category,external_url,updated_at
  from public.calendar_events where is_published and archived_at is null;

create or replace view public.public_documents with (security_invoker=true) as
  select d.id,d.title,d.description,d.document_date,d.category,d.sort_order,d.updated_at,m.storage_path,
    ('/storage/v1/object/public/public-media/' || m.storage_path) as public_path
  from public.documents d
  join public.media_assets m on m.id=d.media_id
  where d.is_published and d.archived_at is null and m.deleted_at is null;

create or replace function public.search_public_content(search_query text, content_type text default null, result_limit integer default 20, result_offset integer default 0)
returns table(title text, href text, type text, excerpt text) language sql stable security invoker as $$
  with entries as (
    select p.title, p.slug href, 'information'::text type, coalesce(p.seo_description,'') excerpt, p.title||' '||coalesce(p.seo_description,'')||' '||p.blocks::text searchable from public.pages p where p.is_published
    union all select n.title, '/senaste-nytt/?nyhet='||n.slug, 'nyheter', n.summary, n.title||' '||n.summary||' '||n.body_blocks::text from public.news_posts n where n.is_published and n.archived_at is null
    union all select d.title, '/dokument/', 'dokument', d.description, d.title||' '||d.description||' '||d.category from public.documents d where d.is_published and d.archived_at is null
    union all select e.title, '/kalender/', 'kalender', e.description, e.title||' '||e.description||' '||coalesce(e.location,'') from public.calendar_events e where e.is_published and e.archived_at is null
  ) select title,href,type,excerpt from entries where (content_type is null or entries.type=content_type) and (coalesce(search_query,'')='' or to_tsvector('swedish',searchable) @@ plainto_tsquery('swedish',search_query)) limit least(result_limit,50) offset greatest(result_offset,0)
$$;

create or replace function public.media_asset_references(target_id uuid)
returns table(source text, reference_count bigint)
language sql stable security definer set search_path = public as $$
  with asset as (select storage_path from public.media_assets where id=target_id)
  select 'Sidor', count(*) from public.pages, asset where social_media_id=target_id or blocks::text like '%'||asset.storage_path||'%'
  union all select 'Nyheter', count(*) from public.news_posts, asset where hero_media_id=target_id or body_blocks::text like '%'||asset.storage_path||'%'
  union all select 'Dokument', count(*) from public.documents where media_id=target_id
  union all select 'Webbplatsinställningar', count(*) from public.site_settings where social_media_id=target_id
$$;

revoke all on function public.media_asset_references(uuid) from public;
grant execute on function public.media_asset_references(uuid) to service_role;
