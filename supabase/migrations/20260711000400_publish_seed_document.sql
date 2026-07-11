-- The object has been uploaded and verified in public-media before this
-- migration is applied, so publishing cannot create a broken public link.
update public.documents
set is_published = true
where media_id = '11111111-1111-4111-8111-111111111111';

update public.pages
set is_published = true
where page_key = 'documents';
