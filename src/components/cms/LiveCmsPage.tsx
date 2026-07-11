import { useEffect, useState } from 'react';
import { cmsPageSchema, type CmsPage } from '../../lib/cms/schema';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import BlockRenderer from './BlockRenderer';
import type { PublicCollections } from '../../lib/supabase/snapshot';

export default function LiveCmsPage({ pageKey, initialPage, initialCollections }: { pageKey: string; initialPage: CmsPage | null; initialCollections: PublicCollections }) {
  const [page, setPage] = useState(initialPage);
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    client.from('public_pages').select('*').eq('page_key', pageKey).maybeSingle().then(({ data }) => {
      const parsed = data ? cmsPageSchema.safeParse(data) : null;
      if (parsed?.success) setPage(parsed.data);
    });
  }, [pageKey]);
  useEffect(() => {
    const fallback = document.querySelector<HTMLElement>('[data-static-page]');
    if (fallback) fallback.hidden = Boolean(page);
  }, [page]);
  useEffect(() => {
    if (!page) return;
    document.title = page.seo_title || `${page.title} | Smedby 1:6`;
    const description = page.seo_description;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description && meta) meta.content = description;
  }, [page]);
  return page ? <BlockRenderer blocks={page.blocks} collections={initialCollections} /> : null;
}
