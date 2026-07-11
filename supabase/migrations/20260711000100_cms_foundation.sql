create extension if not exists pgcrypto;

create table public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/avif','application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  alt_text text not null default '' check (char_length(alt_text) <= 240),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  page_key text not null unique check (page_key ~ '^[a-z0-9-]+$'),
  slug text not null unique check (slug ~ '^/([a-z0-9-]+/)*$' or slug = '/'),
  template text not null check (template in ('standard','home','article','documents')),
  title text not null check (char_length(title) between 1 and 160),
  seo_title text check (char_length(seo_title) <= 200),
  seo_description text check (char_length(seo_description) <= 320),
  social_media_id uuid references public.media_assets(id) on delete set null,
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.news_posts (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null check (char_length(title) between 1 and 160), summary text not null default '' check (char_length(summary) <= 600),
  body_blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(body_blocks) = 'array'), hero_media_id uuid references public.media_assets(id) on delete set null,
  published_at timestamptz, is_published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_by uuid references auth.users(id)
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(), title text not null check (char_length(title) between 1 and 160), description text not null default '' check (char_length(description) <= 2500),
  starts_at timestamptz not null, ends_at timestamptz, all_day boolean not null default false, location text check (char_length(location) <= 240),
  category text not null default 'information' check (category in ('möte','aktivitet','underhåll','information')), external_url text,
  is_published boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  check (ends_at is null or ends_at >= starts_at), check (external_url is null or external_url ~ '^https://')
);

create table public.documents (
  id uuid primary key default gen_random_uuid(), title text not null check (char_length(title) between 1 and 160), description text not null default '' check (char_length(description) <= 1000),
  document_date date, category text not null default 'Övrigt' check (char_length(category) <= 80), media_id uuid not null references public.media_assets(id),
  is_published boolean not null default false, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_by uuid references auth.users(id)
);

create table public.navigation_items (
  id uuid primary key default gen_random_uuid(), label text not null check (char_length(label) between 1 and 120), target_page_key text references public.pages(page_key), external_url text,
  sort_order integer not null default 0, visible boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
  check ((target_page_key is not null)::int + (external_url is not null)::int = 1), check (external_url is null or external_url ~ '^https://')
);

create table public.site_settings (
  id boolean primary key default true check (id), site_name text not null default 'Smedby 1:6', contact_email text,
  footer_text text not null default 'Information för boende i Samfällighetsföreningen Smedby 1:6.', default_seo_title text not null default 'Smedby 1:6 | Samfällighetsföreningen',
  default_seo_description text not null default 'Information för boende i Samfällighetsföreningen Smedby 1:6.', social_media_id uuid references public.media_assets(id) on delete set null,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id text not null, revision_no integer not null,
  snapshot jsonb not null, created_at timestamptz not null default now(), created_by uuid references auth.users(id), restored_from_id uuid references public.content_revisions(id),
  unique(entity_type, entity_id, revision_no)
);

create table public.snapshot_deployments (
  id uuid primary key default gen_random_uuid(), trigger_type text not null check (trigger_type in ('nightly','manual','code')), status text not null check (status in ('queued','in_progress','success','failed')),
  external_run_id bigint, started_at timestamptz not null default now(), completed_at timestamptz, requested_by uuid references auth.users(id), error_summary text check (char_length(error_summary) <= 500)
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create or replace function public.is_active_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin_profiles where user_id = auth.uid() and active);
$$;
revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to anon, authenticated, service_role;

create or replace function public.record_content_revision() returns trigger language plpgsql security definer set search_path = public as $$
declare next_revision integer; actor uuid; record_id text;
begin
  actor := coalesce(nullif(to_jsonb(new)->>'updated_by','')::uuid, nullif(to_jsonb(new)->>'created_by','')::uuid, auth.uid());
  record_id := to_jsonb(new)->>'id';
  select coalesce(max(revision_no), 0) + 1 into next_revision from public.content_revisions where entity_type = tg_table_name and entity_id = record_id;
  insert into public.content_revisions(entity_type, entity_id, revision_no, snapshot, created_by) values (tg_table_name, record_id, next_revision, to_jsonb(new), actor);
  return new;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['admin_profiles','media_assets','pages','news_posts','calendar_events','documents','navigation_items'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', table_name || '_touch', table_name);
  end loop;
  foreach table_name in array array['pages','news_posts','calendar_events','documents','media_assets','navigation_items','site_settings'] loop
    execute format('create trigger %I after insert or update on public.%I for each row execute function public.record_content_revision()', table_name || '_revision', table_name);
  end loop;
end $$;

create trigger site_settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();

insert into public.site_settings(id) values (true) on conflict do nothing;

insert into public.pages(page_key, slug, template, title) values
 ('home','/','home','Startsida'), ('latest-news','/senaste-nytt/','standard','Senaste nytt'), ('calendar','/kalender/','standard','Kalender'),
 ('residents','/for-boende/','standard','För boende'), ('community','/vad-ar-en-samfallighet/','standard','Vad är en samfällighet?'),
 ('traffic','/trafikregler/','standard','Trafikregler'), ('documents','/dokument/','documents','Dokument'), ('contact','/kontakt/','standard','Kontakt'),
 ('members','/medlemmar/','standard','Medlemmar'), ('search','/sok/','standard','Sök'), ('bylaws','/stadgar/','documents','Stadgar')
on conflict (page_key) do nothing;

update public.pages set is_published=true, blocks='[{"type":"hero","heading":"Senaste nytt","text":"Publicerade nyheter och viktig information för boende."},{"type":"news_feed","heading":"Senaste nytt","limit":12}]'::jsonb where page_key='latest-news';
update public.pages set is_published=true, blocks='[{"type":"hero","heading":"Viktiga datum","text":"Här publiceras bekräftade möten, aktiviteter och arbeten som berör området."},{"type":"calendar_feed","heading":"Kommande","limit":12}]'::jsonb where page_key='calendar';
update public.pages set blocks='[{"type":"hero","heading":"Dokument","text":"Här samlas föreningens publika dokument."},{"type":"document_list","heading":"Publika dokument"}]'::jsonb where page_key='documents';

insert into public.news_posts(slug,title,summary,body_blocks,published_at,is_published) values (
 'garage-info-smedby-samfallighet','Garage-info Smedby Samfällighet',
 'Information om byte av panel på garage 6 och 7, tillfällig påverkan på parkeringsplatser och praktiska instruktioner under renoveringen.',
 '[{"type":"rich_text","document":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Här kommer en snabb information gällande bytet av panel på våra garage."}]},{"type":"paragraph","content":[{"type":"text","text":"Kontraktet med Söderköpings Bygg är påskrivet och arbetet med garage nr 6 och nr 7 är under uppstart."}]}]}},{"type":"notice","heading":"Viktigt","text":"Plocka ner allt löst i garagen som riskerar att ramla ner och skada bilar under renoveringen.","tone":"warning"}]'::jsonb,
 '2023-12-03T12:00:00+01:00',true
);

insert into public.navigation_items(label,target_page_key,sort_order) values
 ('Start','home',10),('Senaste nytt','latest-news',20),('Kalender','calendar',30),('För boende','residents',40),('Samfällighet','community',50),('Trafikregler','traffic',60),('Dokument','documents',70),('Kontakt','contact',80),('Medlemmar','members',90),('Sök','search',100)
on conflict do nothing;

insert into public.media_assets(id,storage_path,original_name,mime_type,size_bytes,alt_text) values
 ('11111111-1111-4111-8111-111111111111','documents/stadgar-smedby-samfallighet-1-6-rev-2022-04-25.pdf','stadgar-smedby-samfallighet-1-6-rev-2022-04-25.pdf','application/pdf',1,'')
on conflict do nothing;
insert into public.documents(title,description,document_date,category,media_id,is_published,sort_order) values
 ('Stadgar Smedby Samfällighet 1:6','Reviderade stadgar, 25 april 2022.','2022-04-25','Stadgar','11111111-1111-4111-8111-111111111111',false,10);

alter table public.admin_profiles enable row level security; alter table public.media_assets enable row level security; alter table public.pages enable row level security;
alter table public.news_posts enable row level security; alter table public.calendar_events enable row level security; alter table public.documents enable row level security;
alter table public.navigation_items enable row level security; alter table public.site_settings enable row level security; alter table public.content_revisions enable row level security; alter table public.snapshot_deployments enable row level security;

create policy admin_profile_self on public.admin_profiles for select to authenticated using (user_id = auth.uid());
create policy public_published_pages on public.pages for select to anon, authenticated using (is_published or public.is_active_admin());
create policy public_published_news on public.news_posts for select to anon, authenticated using (is_published or public.is_active_admin());
create policy public_published_events on public.calendar_events for select to anon, authenticated using (is_published or public.is_active_admin());
create policy public_published_documents on public.documents for select to anon, authenticated using (is_published or public.is_active_admin());
create policy public_media_metadata on public.media_assets for select to anon, authenticated using (deleted_at is null or public.is_active_admin());
create policy public_navigation on public.navigation_items for select to anon, authenticated using (visible or public.is_active_admin());
create policy public_settings on public.site_settings for select to anon, authenticated using (true);
create policy admin_revisions on public.content_revisions for select to authenticated using (public.is_active_admin());
create policy admin_deployments on public.snapshot_deployments for select to authenticated using (public.is_active_admin());

create view public.public_pages with (security_invoker=true) as select id,page_key,slug,template,title,seo_title,seo_description,social_media_id,blocks,is_published,updated_at from public.pages where is_published;
create view public.public_news_posts with (security_invoker=true) as select id,slug,title,summary,body_blocks,hero_media_id,published_at,updated_at from public.news_posts where is_published;
create view public.public_calendar_events with (security_invoker=true) as select id,title,description,starts_at,ends_at,all_day,location,category,external_url,updated_at from public.calendar_events where is_published;
create view public.public_documents with (security_invoker=true) as select d.id,d.title,d.description,d.document_date,d.category,d.sort_order,d.updated_at,m.storage_path,('/storage/v1/object/public/public-media/' || m.storage_path) as public_path from public.documents d join public.media_assets m on m.id=d.media_id where d.is_published and m.deleted_at is null;

grant select on public.public_pages, public.public_news_posts, public.public_calendar_events, public.public_documents to anon, authenticated;
grant select on public.pages, public.news_posts, public.calendar_events, public.documents, public.media_assets, public.navigation_items, public.site_settings to anon, authenticated;
grant select on public.admin_profiles, public.content_revisions, public.snapshot_deployments to authenticated;

create or replace function public.search_public_content(search_query text, content_type text default null, result_limit integer default 20, result_offset integer default 0)
returns table(title text, href text, type text, excerpt text) language sql stable security invoker as $$
  with entries as (
    select p.title, p.slug href, 'information'::text type, coalesce(p.seo_description,'') excerpt, p.title||' '||coalesce(p.seo_description,'')||' '||p.blocks::text searchable from public.pages p where p.is_published
    union all select n.title, '/senaste-nytt/?nyhet='||n.slug, 'nyheter', n.summary, n.title||' '||n.summary||' '||n.body_blocks::text from public.news_posts n where n.is_published
    union all select d.title, '/dokument/', 'dokument', d.description, d.title||' '||d.description||' '||d.category from public.documents d where d.is_published
    union all select e.title, '/kalender/', 'kalender', e.description, e.title||' '||e.description||' '||coalesce(e.location,'') from public.calendar_events e where e.is_published
  ) select title,href,type,excerpt from entries where (content_type is null or entries.type=content_type) and (coalesce(search_query,'')='' or to_tsvector('swedish',searchable) @@ plainto_tsquery('swedish',search_query)) limit least(result_limit,50) offset greatest(result_offset,0)
$$;
grant execute on function public.search_public_content(text,text,integer,integer) to anon, authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('public-media','public-media',true,26214400,array['image/jpeg','image/png','image/webp','image/avif','application/pdf']) on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy public_read_media on storage.objects for select to public using (bucket_id='public-media');
create policy admin_insert_media on storage.objects for insert to authenticated with check (bucket_id='public-media' and public.is_active_admin());
create policy admin_update_media on storage.objects for update to authenticated using (bucket_id='public-media' and public.is_active_admin()) with check (bucket_id='public-media' and public.is_active_admin());
create policy admin_delete_media on storage.objects for delete to authenticated using (bucket_id='public-media' and public.is_active_admin());
