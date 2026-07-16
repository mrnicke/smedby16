begin;
select plan(30);

insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','inactive@example.invalid'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','editor@example.invalid'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','admin@example.invalid');
insert into public.admin_profiles(user_id,display_name,active,role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Inactive',false,'admin'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','Editor',true,'editor'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','Admin',true,'admin');

select has_function('public','is_aal2',array[]::text[],'AAL2 helper exists');
select has_function('public','claim_first_admin',array['text'],'audited first-admin flow exists');
select has_function('public','first_admin_claim_available',array[]::text[],'first-admin availability helper exists');
select has_function('public','apply_scheduled_publication',array['uuid','integer','integer'],'atomic scheduled publication helper exists');
select matches(
  pg_get_functiondef('public.claim_first_admin(text)'::regprocedure),
  'pg_advisory_xact_lock',
  'first-admin claims are serialized in the database'
);
select has_table('public','security_audit_log','security audit log exists');
select has_table('public','security_webhook_nonces','webhook replay table exists');
select isnt((select public from storage.buckets where id='media-quarantine'),true,'quarantine bucket is private');
select policies_are('storage','objects',array['public_read_media','quarantine_own_insert','quarantine_own_read','quarantine_own_delete'],'storage writes are quarantined');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated","aal":"aal2"}',true);
select isnt(public.is_active_admin(),true,'inactive profile is denied');
select isnt(public.has_admin_capability('edit_pages'),true,'inactive profile has no capabilities');

select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2","role":"authenticated","aal":"aal2"}',true);
select ok(public.has_admin_capability('edit_pages'),'editor may edit pages');
select ok(public.has_admin_capability('edit_news'),'editor may edit news');
select isnt(public.has_admin_capability('manage_media'),true,'editor may not manage media');
select isnt(public.has_admin_capability('trigger_deploy'),true,'editor may not trigger deploys');

select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3","role":"authenticated","aal":"aal1"}',true);
select ok(public.has_admin_capability('manage_media'),'admin role has media capability');
select isnt(public.is_aal2(),true,'admin AAL1 is not AAL2');

select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3","role":"authenticated","aal":"aal2"}',true);
select ok(public.is_aal2(),'admin AAL2 is accepted');
select ok(public.has_admin_capability('manage_navigation'),'admin may manage navigation');
select ok(public.has_admin_capability('manage_revisions'),'admin may manage revisions');
select ok(public.has_admin_capability('trigger_deploy'),'admin may trigger deploys');

reset role;
select ok(has_function_privilege('authenticated','public.first_admin_claim_available()','EXECUTE'),'authenticated users may check bootstrap availability');
select ok(has_function_privilege('service_role','public.apply_scheduled_publication(uuid,integer,integer)','EXECUTE'),'only the service role may apply scheduled publications');
select ok(has_table_privilege('service_role','public.security_webhook_nonces','SELECT,INSERT,DELETE'),'service role owns webhook replay state');

insert into public.pages(id,page_key,slug,template,title,blocks,is_published,created_by,updated_by)
values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','scheduled-safe','/scheduled-safe/','standard','Scheduled safe','[]',false,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','scheduled-locked','/scheduled-locked/','standard','Scheduled locked','[]',false,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3');
insert into public.content_drafts(entity_type,entity_id,snapshot,draft_version,base_published_version,updated_by)
values
 ('page','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','{"version":2,"root":[]}',1,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'),
 ('page','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','{"version":2,"root":[]}',1,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3');
insert into public.scheduled_publications(id,entity_type,entity_id,action,execute_at,status,attempts,requested_by)
values
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','page','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','publish',now(),'processing',1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'),
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2','page','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','publish',now(),'processing',1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3');
insert into public.content_locks(entity_type,entity_id,user_id,expires_at)
values ('page','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',now()+interval '2 minutes');

set local role service_role;
select is((public.apply_scheduled_publication('cccccccc-cccc-4ccc-8ccc-ccccccccccc1',1,1)).status,'completed','valid scheduled publication completes atomically');
select is((select published_version from public.pages where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),2,'scheduled publication advances the published version');
select ok((select is_published from public.pages where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),'scheduled publication makes the page public');
select is((select count(*)::integer from public.content_drafts where entity_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),0,'scheduled publication consumes the validated draft');
select throws_ok(
  $$select public.apply_scheduled_publication('cccccccc-cccc-4ccc-8ccc-ccccccccccc2',1,1)$$,
  '55P03','active_editor_lock','an active editor lock blocks scheduled publication'
);
select isnt((select is_published from public.pages where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'),true,'a lock conflict leaves content unpublished');
reset role;
select * from finish();
rollback;
