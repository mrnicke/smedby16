import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY och SUPABASE_SERVICE_ROLE_KEY krävs.');
}

const service = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonymous = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = randomUUID();
const suffix = runId.slice(0, 8);
const adminEmail = `e2e-admin-${suffix}@example.invalid`;
const inactiveEmail = `e2e-inactive-${suffix}@example.invalid`;
const signupEmail = `e2e-signup-${suffix}@example.invalid`;
const password = `${randomBytes(18).toString('base64url')}Aa1!`;
const storagePath = `documents/e2e-${runId}.pdf`;
const createdIds = [];
const userIds = [];
let uploaded = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createUser(email, active) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`Kunde inte skapa ${email}.`);
  userIds.push(data.user.id);
  if (active !== null) {
    const { error: profileError } = await service.from('admin_profiles').insert({
      user_id: data.user.id,
      display_name: active ? 'Lokal E2E-administratör' : 'Lokal E2E-inaktiv',
      active,
    });
    if (profileError) throw profileError;
  }
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sessionData, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !sessionData.session) throw signInError ?? new Error(`Kunde inte logga in ${email}.`);
  return { client, token: sessionData.session.access_token, user: data.user };
}

async function invoke(functionName, token, body) {
  const headers = { apikey: anonKey, 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { status: response.status, payload };
}

async function save(token, entity, payload) {
  const response = await invoke('save-content', token, { entity, payload });
  assert(response.status === 200, `${entity} kunde inte sparas (HTTP ${response.status}).`);
  assert(response.payload?.data?.id, `${entity} saknar sparat id.`);
  createdIds.push({ entity, id: response.payload.data.id });
  return response.payload.data;
}

async function cleanup() {
  const idsByEntity = new Map();
  for (const item of createdIds) {
    const ids = idsByEntity.get(item.entity) ?? new Set();
    ids.add(item.id);
    idsByEntity.set(item.entity, ids);
  }

  for (const entity of ['documents', 'calendar_events', 'news_posts']) {
    const ids = [...(idsByEntity.get(entity) ?? [])];
    if (ids.length) {
      const { error } = await service.from(entity).delete().in('id', ids);
      if (error) throw error;
    }
  }

  const navigationIds = [...(idsByEntity.get('navigation_items') ?? [])];
  if (navigationIds.length) {
    const { error } = await service.from('navigation_items').delete().in('id', navigationIds);
    if (error) throw error;
  }

  const revisionIds = createdIds.map((item) => item.id);
  if (revisionIds.length) {
    const { error } = await service.from('content_revisions').delete().in('entity_id', revisionIds);
    if (error) throw error;
  }

  const mediaIds = [...(idsByEntity.get('media_assets') ?? [])];
  if (mediaIds.length) {
    const { error } = await service.from('media_assets').delete().in('id', mediaIds);
    if (error) throw error;
  }
  if (uploaded) {
    const { error } = await service.storage.from('public-media').remove([storagePath]);
    if (error) throw error;
  }

  if (userIds.length) {
    const { error } = await service.from('admin_profiles').delete().in('user_id', userIds);
    if (error) throw error;
  }
  for (const userId of [...userIds].reverse()) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw error;
  }

  const contentIds = createdIds.filter((item) => item.entity !== 'media_assets').map((item) => item.id);
  const remainingCounts = await Promise.all(
    ['news_posts', 'calendar_events', 'documents'].map(async (entity) => {
      const ids = [...(idsByEntity.get(entity) ?? [])];
      if (!ids.length) return 0;
      const { count, error } = await service.from(entity).select('id', { count: 'exact', head: true }).in('id', ids);
      if (error) throw error;
      return count ?? 0;
    }),
  );
  const { count: revisionCount, error: remainingRevisionError } = contentIds.length
    ? await service.from('content_revisions').select('id', { count: 'exact', head: true }).in('entity_id', contentIds)
    : { count: 0, error: null };
  if (remainingRevisionError) throw remainingRevisionError;
  const { data: users, error: listUsersError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listUsersError) throw listUsersError;
  const { count: mediaCount, error: remainingMediaError } = mediaIds.length
    ? await service.from('media_assets').select('id', { count: 'exact', head: true }).in('id', mediaIds)
    : { count: 0, error: null };
  if (remainingMediaError) throw remainingMediaError;
  const { data: storedFiles, error: storedFilesError } = await service.storage
    .from('public-media')
    .list('documents', { search: `e2e-${runId}.pdf` });
  if (storedFilesError) throw storedFilesError;
  assert(remainingCounts.every((count) => count === 0), 'E2E-innehåll blev kvar efter städning.');
  if (navigationIds.length) {
    const { count, error } = await service.from('navigation_items').select('id', { count: 'exact', head: true }).in('id', navigationIds);
    if (error) throw error;
    assert((count ?? 0) === 0, 'E2E-navigation blev kvar efter städning.');
  }
  assert((revisionCount ?? 0) === 0, 'E2E-revisioner blev kvar efter städning.');
  assert((mediaCount ?? 0) === 0 && storedFiles.length === 0, 'E2E-media blev kvar efter städning.');
  assert(!users.users.some((user) => userIds.includes(user.id)), 'E2E-användare blev kvar efter städning.');
  console.log('PASS temporary users, content, revisions and media cleaned up');
}

try {
  const { data: signupData, error: signupError } = await anonymous.auth.signUp({ email: signupEmail, password });
  if (signupData.user) userIds.push(signupData.user.id);
  assert(signupError && !signupData.user, 'Publik e-postregistrering är inte avstängd.');

  const admin = await createUser(adminEmail, true);
  const inactive = await createUser(inactiveEmail, false);

  const anonymousSave = await invoke('save-content', null, { entity: 'news_posts', payload: {} });
  assert(anonymousSave.status === 401, `Anonym Edge Function gav ${anonymousSave.status}, väntade 401.`);

  const inactiveSave = await invoke('save-content', inactive.token, { entity: 'news_posts', payload: {} });
  assert(inactiveSave.status === 403, `Inaktiv användare gav ${inactiveSave.status}, väntade 403.`);

  const { error: directWriteError } = await admin.client.from('news_posts').insert({
    slug: `forbidden-${suffix}`,
    title: 'Direkt skrivning ska nekas',
    summary: '',
    body_blocks: [],
    is_published: false,
  });
  assert(directWriteError, 'En administratör kunde skriva direkt till innehållstabellen.');

  const invalidBlock = await invoke('save-content', admin.token, {
    entity: 'news_posts',
    payload: {
      slug: `invalid-${suffix}`,
      title: 'Ogiltigt block',
      summary: '',
      body_blocks: [{ type: 'script', html: '<script>alert(1)</script>' }],
      hero_media_id: null,
      published_at: new Date().toISOString(),
      is_published: false,
    },
  });
  assert(invalidBlock.status === 400, `Ogiltigt block gav ${invalidBlock.status}, väntade 400.`);

  const invalidLink = await invoke('save-content', admin.token, {
    entity: 'news_posts',
    payload: {
      slug: `invalid-link-${suffix}`,
      title: 'Ogiltig intern länk',
      summary: '',
      body_blocks: [{ type: 'rich_text', document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Trasig länk', marks: [{ type: 'link', attrs: { href: '/finns-inte/' } }] }] }] } }],
      hero_media_id: null,
      published_at: new Date().toISOString(),
      is_published: false,
    },
  });
  assert(invalidLink.status === 400, `Okänd intern länk gav ${invalidLink.status}, väntade 400.`);

  const navigation = await save(admin.token, 'navigation_items', {
    label: `E2E-länk ${suffix}`,
    target_page_key: 'home',
    external_url: null,
    sort_order: 999,
    visible: false,
  });
  const navigationDelete = await invoke('manage-navigation', admin.token, { id: navigation.id, action: 'delete' });
  assert(navigationDelete.status === 200, `Navigationsradering gav ${navigationDelete.status}.`);

  const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n');
  const { error: uploadError } = await admin.client.storage.from('public-media').upload(storagePath, pdf, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) throw uploadError;
  uploaded = true;

  const media = await save(admin.token, 'media_assets', {
    storage_path: storagePath,
    original_name: `e2e-${suffix}.pdf`,
    mime_type: 'application/pdf',
    size_bytes: pdf.byteLength,
    width: null,
    height: null,
    alt_text: '',
  });

  const originalTitle = `Lokal E2E-nyhet ${suffix}`;
  const news = await save(admin.token, 'news_posts', {
    slug: `e2e-nyhet-${suffix}`,
    title: originalTitle,
    summary: 'Tillfällig publicerad E2E-nyhet.',
    body_blocks: [{
      type: 'rich_text',
      document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'E2E-innehåll.' }] }] },
    }],
    hero_media_id: null,
    published_at: new Date().toISOString(),
    is_published: true,
  });

  const startsAt = new Date(Date.now() + 86_400_000);
  const event = await save(admin.token, 'calendar_events', {
    title: `Lokal E2E-aktivitet ${suffix}`,
    description: 'Tillfällig kalenderpost.',
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + 3_600_000).toISOString(),
    all_day: false,
    location: 'Lokalt test',
    category: 'information',
    external_url: null,
    is_published: true,
  });

  const document = await save(admin.token, 'documents', {
    title: `Lokalt E2E-dokument ${suffix}`,
    description: 'Tillfälligt PDF-dokument.',
    document_date: new Date().toISOString().slice(0, 10),
    category: 'E2E',
    media_id: media.id,
    is_published: true,
    sort_order: 999,
  });

  const updatedNews = await invoke('save-content', admin.token, {
    entity: 'news_posts',
    payload: {
      id: news.id,
      slug: news.slug,
      title: `${originalTitle} uppdaterad`,
      summary: news.summary,
      body_blocks: news.body_blocks,
      hero_media_id: null,
      published_at: new Date(news.published_at).toISOString(),
      is_published: true,
    },
  });
  assert(updatedNews.status === 200, `Nyhetsuppdatering gav HTTP ${updatedNews.status}.`);

  const { data: revisions, error: revisionError } = await service
    .from('content_revisions')
    .select('id,revision_no')
    .eq('entity_type', 'news_posts')
    .eq('entity_id', news.id)
    .order('revision_no');
  if (revisionError) throw revisionError;
  assert(revisions?.length >= 2, 'Nyhetsuppdateringen skapade inte revisionshistorik.');

  const restored = await invoke('restore-revision', admin.token, { revisionId: revisions[0].id });
  assert(restored.status === 200, `Återställning gav HTTP ${restored.status}.`);
  assert(restored.payload?.data?.title === originalTitle, 'Revisionen återställde inte ursprunglig titel.');

  const [publicNews, publicEvents, publicDocuments] = await Promise.all([
    anonymous.from('news_posts').select('id').eq('id', news.id).single(),
    anonymous.from('calendar_events').select('id').eq('id', event.id).single(),
    anonymous.from('public_documents').select('id,public_path').eq('id', document.id).single(),
  ]);
  assert(!publicNews.error, 'Den publicerade nyheten kunde inte läsas anonymt.');
  assert(!publicEvents.error, 'Den publicerade kalenderposten kunde inte läsas anonymt.');
  assert(!publicDocuments.error && publicDocuments.data.public_path.includes(storagePath), 'PDF-dokumentet saknar publik mediareferens.');

  const mediaDeleteBlocked = await invoke('manage-media', admin.token, { id: media.id, action: 'delete' });
  assert(mediaDeleteBlocked.status === 409, `Refererad media gav ${mediaDeleteBlocked.status}, väntade 409.`);

  const archiveNews = await invoke('manage-content', admin.token, { entity: 'news_posts', id: news.id, action: 'archive' });
  assert(archiveNews.status === 200 && archiveNews.payload?.data?.archived_at, 'Nyheten kunde inte arkiveras.');
  const { data: archivedPublicNews } = await anonymous.from('news_posts').select('id').eq('id', news.id);
  assert(archivedPublicNews?.length === 0, 'Arkiverad nyhet var fortfarande publik.');
  const restoreNews = await invoke('manage-content', admin.token, { entity: 'news_posts', id: news.id, action: 'restore' });
  assert(restoreNews.status === 200 && !restoreNews.payload?.data?.archived_at && !restoreNews.payload?.data?.is_published, 'Nyheten återställdes inte som opublicerad.');

  const prematureDelete = await invoke('manage-content', admin.token, { entity: 'calendar_events', id: event.id, action: 'delete' });
  assert(prematureDelete.status === 409, `Oarkiverad permanent radering gav ${prematureDelete.status}, väntade 409.`);
  const archiveEvent = await invoke('manage-content', admin.token, { entity: 'calendar_events', id: event.id, action: 'archive' });
  assert(archiveEvent.status === 200, 'Kalenderposten kunde inte arkiveras.');
  const deleteEvent = await invoke('manage-content', admin.token, { entity: 'calendar_events', id: event.id, action: 'delete' });
  assert(deleteEvent.status === 200, 'Arkiverad kalenderpost kunde inte tas bort permanent.');

  const archiveDocument = await invoke('manage-content', admin.token, { entity: 'documents', id: document.id, action: 'archive' });
  assert(archiveDocument.status === 200, 'Dokumentet kunde inte arkiveras.');
  const mediaStillBlocked = await invoke('manage-media', admin.token, { id: media.id, action: 'delete' });
  assert(mediaStillBlocked.status === 409, 'Media som används av arkiverat innehåll kunde tas bort.');
  const deleteDocument = await invoke('manage-content', admin.token, { entity: 'documents', id: document.id, action: 'delete' });
  assert(deleteDocument.status === 200, 'Arkiverat dokument kunde inte tas bort permanent.');
  const mediaDelete = await invoke('manage-media', admin.token, { id: media.id, action: 'delete' });
  assert(mediaDelete.status === 200, 'Orefererad media kunde inte tas bort.');

  console.log('PASS public signup disabled');
  console.log('PASS anonymous write denied (401)');
  console.log('PASS inactive admin denied (403)');
  console.log('PASS direct table write denied');
  console.log('PASS unsafe block rejected (400)');
  console.log('PASS unknown internal link rejected (400)');
  console.log('PASS navigation saved and deleted through authenticated functions');
  console.log('PASS authenticated PDF upload and media metadata');
  console.log('PASS news, calendar event and document saved through Edge Function');
  console.log('PASS revision created and restored');
  console.log('PASS published resources readable anonymously');
  console.log('PASS content archive, restore and guarded permanent deletion');
  console.log('PASS referenced media deletion blocked and unreferenced media removed');
} finally {
  await cleanup();
}
