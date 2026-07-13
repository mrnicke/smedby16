begin;
select plan(42);
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
select has_column('public','admin_profiles','role','admin profiles have roles');
select has_column('public','pages','editor_document','pages support editor v2');
select has_column('public','news_posts','editor_document','news supports editor v2');
select has_column('public','pages','archived_at','pages can be archived without deletion');
select has_table('public','content_drafts','server autosave drafts exist');
select has_table('public','content_locks','editing locks exist');
select has_table('public','editor_templates','editor templates exist');
select has_table('public','reusable_components','reusable components exist');
select has_table('public','global_layouts','global layouts exist');
select has_table('public','scheduled_publications','scheduled publications exist');
select has_table('public','content_redirects','redirects exist');
select ok((select relrowsecurity from pg_class where oid='public.content_drafts'::regclass),'draft RLS is enabled');
select ok((select relrowsecurity from pg_class where oid='public.editor_templates'::regclass),'template RLS is enabled');
select has_function('public','has_admin_capability',array['text'],'capabilities are server enforced');
select policies_are('public','editor_templates',array['active_templates_read'],'templates cannot be directly mutated by clients');
select policies_are('public','global_layouts',array['public_global_layouts_read'],'global layouts cannot be directly mutated by clients');
select policies_are('public','content_drafts',array['editor_drafts_read','editor_drafts_insert','editor_drafts_update'],'draft access is explicit');
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
