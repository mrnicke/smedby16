import { z } from 'zod';

const safeUrl = z.string().trim().refine((value) => {
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    return ['https:', 'mailto:', 'tel:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, 'Ange en säker intern länk eller en https-, mailto- eller tel-länk.');

const imageSchema = z.object({
  src: safeUrl,
  alt: z.string().trim().max(240),
});

export const richTextDocumentSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.unknown()).default([]),
});

const linkSchema = z.object({
  label: z.string().trim().min(1).max(120),
  href: safeUrl,
});

export const contentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hero'), heading: z.string().min(1).max(160), text: z.string().max(500).default(''), image: imageSchema.optional(), action: linkSchema.optional() }),
  z.object({ type: z.literal('rich_text'), heading: z.string().max(160).optional(), document: richTextDocumentSchema }),
  z.object({ type: z.literal('card_grid'), heading: z.string().max(160).optional(), cards: z.array(z.object({ title: z.string().min(1).max(160), text: z.string().max(700), link: linkSchema.optional() })).min(1).max(12) }),
  z.object({ type: z.literal('notice'), heading: z.string().min(1).max(160), text: z.string().max(1200), tone: z.enum(['info', 'warning', 'success']).default('info') }),
  z.object({ type: z.literal('image_text'), heading: z.string().min(1).max(160), text: z.string().max(1800), image: imageSchema, imagePosition: z.enum(['left', 'right']).default('right') }),
  z.object({ type: z.literal('link_list'), heading: z.string().max(160).optional(), links: z.array(linkSchema).min(1).max(30) }),
  z.object({ type: z.literal('area_guide'), heading: z.string().min(1).max(160), text: z.string().max(1000), image: imageSchema.optional(), links: z.array(linkSchema).max(12).default([]) }),
  z.object({ type: z.literal('faq'), heading: z.string().max(160).optional(), items: z.array(z.object({ question: z.string().min(1).max(240), answer: z.string().min(1).max(2500) })).min(1).max(30) }),
  z.object({ type: z.literal('news_feed'), heading: z.string().max(160).default('Senaste nytt'), limit: z.number().int().min(1).max(12).default(3) }),
  z.object({ type: z.literal('calendar_feed'), heading: z.string().max(160).default('Kommande datum'), limit: z.number().int().min(1).max(12).default(5) }),
  z.object({ type: z.literal('document_list'), heading: z.string().max(160).default('Dokument'), category: z.string().max(80).optional() }),
  z.object({ type: z.literal('search_teaser'), heading: z.string().max(160).default('Sök på webbplatsen'), text: z.string().max(500).default('Hitta regler, dokument och information.') }),
]);

export const blockListSchema = z.array(contentBlockSchema).max(40);
export type ContentBlock = z.infer<typeof contentBlockSchema>;

export const pageTemplateSchema = z.enum(['standard', 'home', 'article', 'documents']);
export const cmsPageSchema = z.object({
  id: z.string().uuid(),
  page_key: z.string().regex(/^[a-z0-9-]+$/),
  slug: z.string().regex(/^\/[a-z0-9\-/]*\/$|^\/$/),
  template: pageTemplateSchema,
  title: z.string().min(1).max(160),
  seo_title: z.string().max(200).nullable().optional(),
  seo_description: z.string().max(320).nullable().optional(),
  social_media_id: z.string().uuid().nullable().optional(),
  blocks: blockListSchema,
  is_published: z.boolean(),
  updated_at: z.string(),
});
export type CmsPage = z.infer<typeof cmsPageSchema>;

export const pageTemplateRules: Record<z.infer<typeof pageTemplateSchema>, { allowed: ContentBlock['type'][]; required: ContentBlock['type'][] }> = {
  home: { allowed: ['hero', 'area_guide', 'card_grid', 'notice', 'image_text', 'link_list', 'news_feed', 'calendar_feed', 'document_list', 'search_teaser', 'faq', 'rich_text'], required: ['hero'] },
  standard: { allowed: ['hero', 'rich_text', 'card_grid', 'notice', 'image_text', 'link_list', 'faq', 'news_feed', 'calendar_feed', 'document_list', 'search_teaser'], required: [] },
  article: { allowed: ['hero', 'rich_text', 'notice', 'image_text', 'link_list', 'faq'], required: ['rich_text'] },
  documents: { allowed: ['hero', 'rich_text', 'notice', 'document_list', 'link_list'], required: ['document_list'] },
};

export function validatePageBlocks(template: z.infer<typeof pageTemplateSchema>, blocks: ContentBlock[]) {
  const parsed = blockListSchema.parse(blocks);
  const rules = pageTemplateRules[template];
  const disallowed = parsed.find((block) => !rules.allowed.includes(block.type));
  if (disallowed) throw new Error(`Blocktypen ${disallowed.type} är inte tillåten i mallen ${template}.`);
  const missing = rules.required.find((type) => !parsed.some((block) => block.type === type));
  if (missing) throw new Error(`Mallen ${template} kräver blocktypen ${missing}.`);
  return parsed;
}

export const knownPageKeys = ['home', 'latest-news', 'calendar', 'residents', 'community', 'traffic', 'documents', 'contact', 'members', 'search', 'bylaws'] as const;

export function pageKeyFromPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const map: Record<string, typeof knownPageKeys[number]> = {
    '/': 'home', '/senaste-nytt': 'latest-news', '/kalender': 'calendar', '/for-boende': 'residents',
    '/vad-ar-en-samfallighet': 'community', '/trafikregler': 'traffic', '/dokument': 'documents',
    '/kontakt': 'contact', '/medlemmar': 'members', '/sok': 'search', '/stadgar': 'bylaws',
  };
  return map[normalized] ?? null;
}
