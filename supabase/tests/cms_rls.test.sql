begin;
select plan(25);
select has_table('public','pages','pages exists');
select has_table('public','content_revisions','revision history exists');
select has_function('public','search_public_content',array['text','text','integer','integer'],'public search exists');
select policies_are('public','pages',array['public_published_pages'],'pages has an explicit read policy');
select policies_are('public','content_revisions',array['admin_revisions'],'revisions are admin only');
select ok((select relrowsecurity from pg_class where oid='public.pages'::regclass),'RLS enabled on pages');
select ok((select public from storage.buckets where id='public-media'),'public media bucket exists');
select is((select count(*)::int from public.pages),11,'all fixed pages are seeded');
select function_privs_are('public','is_active_admin',array[]::text[], 'anon', array['EXECUTE'], 'anon may evaluate the admin helper in published-content RLS');
select has_view('public','public_navigation_items','public navigation view exists');
select has_column('public','news_posts','archived_at','news can be archived');
select has_column('public','calendar_events','archived_at','calendar events can be archived');
select has_column('public','documents','archived_at','documents can be archived');
select has_function('public','media_asset_references',array['uuid'],'media reference guard exists');
select ok(
  has_function_privilege('service_role', 'public.media_asset_references(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.media_asset_references(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.media_asset_references(uuid)', 'EXECUTE'),
  'only server-side media management can inspect references'
);
insert into public.news_posts(slug,title,summary,body_blocks,published_at,is_published,archived_at)
values ('archived-test','Archived test','Should stay private','[]'::jsonb,now(),true,now());
set local role anon;
select is((select count(*)::int from public.public_navigation_items),10,'anon sees all visible fixed navigation routes');
select is((select count(*)::int from public.public_pages),11,'anon sees all migrated fixed pages');
select ok((select count(*) > 0 from public.search_public_content('parkering',null,20,0)),'public search finds migrated page content');
select is((select count(*)::int from public.public_news_posts where slug='archived-test'),0,'archived published flag cannot leak through public view');
reset role;
select is((select count(*)::int from public.public_documents),1,'seed document is publicly listed after verified upload');
select is((select count(*)::int from public.public_pages where page_key='documents'),1,'documents CMS page is published');
select is((select blocks->0->>'type' from public.pages where page_key='home'),'hero','home starts with a hero block');
select is((select jsonb_array_length(body_blocks) from public.news_posts where slug='garage-info-smedby-samfallighet'),3,'the complete garage news body is migrated');
select is((select count(*)::int from public.pages where is_published and nullif(seo_description,'') is not null),11,'all fixed pages have SEO descriptions');
select ok(
  has_table_privilege('service_role', 'public.admin_profiles', 'SELECT,INSERT,UPDATE,DELETE')
  and has_table_privilege('service_role', 'public.news_posts', 'SELECT,INSERT,UPDATE,DELETE')
  and has_table_privilege('service_role', 'public.calendar_events', 'SELECT,INSERT,UPDATE,DELETE')
  and has_table_privilege('service_role', 'public.documents', 'SELECT,INSERT,UPDATE,DELETE')
  and has_table_privilege('service_role', 'public.media_assets', 'SELECT,INSERT,UPDATE,DELETE')
  and has_table_privilege('service_role', 'public.content_revisions', 'SELECT,INSERT,UPDATE,DELETE')
  and has_table_privilege('service_role', 'public.snapshot_deployments', 'SELECT,INSERT,UPDATE,DELETE'),
  'service role has server-side CMS table privileges'
);
select * from finish();
rollback;
