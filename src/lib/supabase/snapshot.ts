import { createClient } from '@supabase/supabase-js';
import { cmsPageSchema, type CmsPage } from '../cms/schema';
import { getPublicSupabaseConfig } from './config';

export async function getPublishedPageSnapshot(pageKey: string): Promise<CmsPage | null> {
  const config = getPublicSupabaseConfig();
  if (!config) {
    if (import.meta.env.CMS_REQUIRED === 'true') throw new Error('CMS_REQUIRED är aktivt men publik Supabase-konfiguration saknas.');
    return null;
  }
  try {
    const client = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.from('public_pages').select('*').eq('page_key', pageKey).maybeSingle();
    if (error) throw error;
    return data ? cmsPageSchema.parse(data) : null;
  } catch (error) {
    if (import.meta.env.CMS_REQUIRED === 'true') throw error;
    console.warn(`CMS-snapshot för ${pageKey} kunde inte hämtas; statisk fallback används.`);
    return null;
  }
}

export async function getPublicMediaUrl(mediaId?: string | null): Promise<string | null> {
  if (!mediaId) return null;
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  try {
    const client = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.from('media_assets').select('storage_path').eq('id', mediaId).is('deleted_at', null).maybeSingle();
    if (error || !data?.storage_path) return null;
    return client.storage.from('public-media').getPublicUrl(data.storage_path).data.publicUrl;
  } catch {
    return null;
  }
}

export async function getChromeSnapshot() {
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  try {
    const client = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const [{ data: navigation, error: navError }, { data: settings, error: settingsError }] = await Promise.all([
      client.from('public_navigation_items').select('*').order('sort_order'),
      client.from('site_settings').select('*').single(),
    ]);
    if (navError || settingsError) throw navError ?? settingsError;
    const socialMediaUrl = await getPublicMediaUrl(settings?.social_media_id);
    return { navigation: navigation ?? [], settings, socialMediaUrl };
  } catch (error) {
    if (import.meta.env.CMS_REQUIRED === 'true') throw error;
    return null;
  }
}

export type PublicCollections = { news: any[]; calendar: any[]; documents: any[] };
export async function getPublicCollectionsSnapshot(): Promise<PublicCollections> {
  const empty = { news: [], calendar: [], documents: [] };
  const config = getPublicSupabaseConfig();
  if (!config) return empty;
  try {
    const client = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const [news, calendar, documents] = await Promise.all([
      client.from('public_news_posts').select('*').order('published_at', { ascending: false }).limit(20),
      client.from('public_calendar_events').select('*').order('starts_at').limit(30),
      client.from('public_documents').select('*').order('sort_order').limit(50),
    ]);
    if (news.error || calendar.error || documents.error) throw news.error ?? calendar.error ?? documents.error;
    return {
      news: news.data ?? [], calendar: calendar.data ?? [],
      documents: (documents.data ?? []).map((item) => ({ ...item, public_url: client.storage.from('public-media').getPublicUrl(item.storage_path).data.publicUrl })),
    };
  } catch (error) {
    if (import.meta.env.CMS_REQUIRED === 'true') throw error;
    return empty;
  }
}
