export type CmsResourceKind = 'news_posts' | 'calendar_events' | 'documents';
export type CmsResourceDraft = Record<string, any>;

export function createResourceDraft(kind: CmsResourceKind): CmsResourceDraft {
  if (kind === 'news_posts') return {
    slug: 'ny-nyhet', title: 'Ny nyhet', summary: '',
    body_blocks: [{ type: 'rich_text', document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Skriv nyhetstext här.' }] }] } }],
    published_at: new Date().toISOString(), hero_media_id: null, is_published: false,
  };
  if (kind === 'calendar_events') return {
    title: 'Ny aktivitet', description: '', starts_at: new Date().toISOString(), ends_at: null,
    all_day: false, location: null, category: 'information', external_url: null, is_published: false,
  };
  return { title: 'Nytt dokument', description: '', document_date: null, category: 'Övrigt', media_id: '', is_published: false, sort_order: 0 };
}
