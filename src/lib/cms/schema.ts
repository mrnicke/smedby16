import { z } from 'zod';

export const safeUrlSchema = z.string().trim().refine((value) => {
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    return ['https:', 'mailto:', 'tel:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, 'Ange en säker intern länk eller en https-, mailto- eller tel-länk.');

const imageSchema = z.object({
  src: safeUrlSchema,
  alt: z.string().trim().max(240),
  decorative: z.boolean().default(false).optional(),
  crop: z.enum(['original', 'square', 'landscape', 'portrait', 'wide']).default('original').optional(),
  focusX: z.number().min(0).max(1).default(0.5).optional(),
  focusY: z.number().min(0).max(1).default(0.5).optional(),
});

export const richTextDocumentSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.unknown()).default([]),
});

const linkSchema = z.object({
  label: z.string().trim().min(1).max(120),
  href: safeUrlSchema,
});
const approvedEmbedUrlSchema=safeUrlSchema.refine(value=>{try{const url=new URL(value);return url.protocol==='https:'&&['www.youtube-nocookie.com','player.vimeo.com'].includes(url.hostname);}catch{return false;}},'Endast godkända YouTube- och Vimeo-inbäddningar är tillåtna.');

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
  z.object({type:z.literal('heading'),level:z.union([z.literal(2),z.literal(3)]),text:z.string().trim().min(1).max(160)}),
  z.object({type:z.literal('image'),image:imageSchema}),
  z.object({type:z.literal('button'),label:z.string().trim().min(1).max(120),href:safeUrlSchema,variant:z.enum(['primary','secondary','text']).default('primary')}),
  z.object({type:z.literal('divider'),variant:z.enum(['subtle','strong']).default('subtle')}),
  z.object({type:z.literal('spacer'),size:z.enum(['small','medium','large']).default('medium')}),
  z.object({type:z.literal('approved_embed'),url:approvedEmbedUrlSchema,title:z.string().trim().min(1).max(160),aspect:z.enum(['16:9','4:3']).default('16:9')}),
]);

export const blockListSchema = z.array(contentBlockSchema).max(40);
export type ContentBlock = z.infer<typeof contentBlockSchema>;

const editorContentBlockSchema = z.object({ id: z.string().uuid() }).and(contentBlockSchema);
export const componentInstanceSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('component_instance'),
  componentId: z.string().uuid(),
  properties: z.record(z.string(), z.unknown()).default({}),
});
export const editorNodeSchema = z.union([editorContentBlockSchema, componentInstanceSchema]);
export const editorColumnSchema = z.object({
  id: z.string().uuid(), type: z.literal('column'), width: z.union([z.literal(1), z.literal(2), z.literal(3)]), blocks: z.array(editorNodeSchema).max(40),
}).strict();
export const editorSectionSchema = z.object({
  id: z.string().uuid(), type: z.literal('section'), variant: z.enum(['default', 'muted', 'accent', 'contrast']).default('default'),
  width: z.enum(['normal', 'wide', 'full']).default('normal'), spacing: z.enum(['compact', 'normal', 'spacious']).default('normal'),
  columns: z.array(editorColumnSchema).min(1).max(3),
}).strict().superRefine((section, context) => {
  if (section.columns.reduce((sum, column) => sum + column.width, 0) > 3) context.addIssue({ code: 'custom', path: ['columns'], message: 'Kolumnerna får tillsammans vara högst tre delar breda.' });
});
export const editorDocumentV2Schema = z.object({ version: z.literal(2), root: z.array(editorSectionSchema).max(40) }).strict();
export type EditorDocumentV2 = z.infer<typeof editorDocumentV2Schema>;
export type EditorSection = z.infer<typeof editorSectionSchema>;
export type EditorNode = z.infer<typeof editorNodeSchema>;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function stableUuid(seed: string) {
  let a = 0x811c9dc5; let b = 0x9e3779b9; let c = 0x85ebca6b; let d = 0xc2b2ae35;
  for (let index = 0; index < seed.length; index += 1) { const code = seed.charCodeAt(index); a = Math.imul(a ^ code, 16777619); b = Math.imul(b ^ code, 2246822519); c = Math.imul(c ^ code, 3266489917); d = Math.imul(d ^ code, 668265263); }
  const hex = [a, b, c, d].map((part) => (part >>> 0).toString(16).padStart(8, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function migrateLegacyBlocks(input: ContentBlock[] | EditorDocumentV2, entitySeed = 'legacy'): EditorDocumentV2 {
  const existing = editorDocumentV2Schema.safeParse(input);
  if (existing.success) return existing.data;
  const blocks = blockListSchema.parse(input);
  return editorDocumentV2Schema.parse({ version: 2, root: blocks.map((block, index) => {
    const seed = `${entitySeed}:${index}:${stableStringify(block)}`;
    return { id: stableUuid(`${seed}:section`), type: 'section', variant: 'default', width: 'normal', spacing: 'normal', columns: [{ id: stableUuid(`${seed}:column`), type: 'column', width: 1, blocks: [{ ...block, id: stableUuid(`${seed}:block`) }] }] };
  }) });
}

export function editorDocumentToLegacyBlocks(document: EditorDocumentV2): ContentBlock[] {
  return editorDocumentV2Schema.parse(document).root.flatMap((section) => section.columns.flatMap((column) => column.blocks.flatMap((node) => {
    if (node.type === 'component_instance') return [];
    const { id: _id, ...block } = node;
    return [contentBlockSchema.parse(block)];
  })));
}

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
  editor_version: z.union([z.literal(1), z.literal(2)]).default(1).optional(),
  editor_document: editorDocumentV2Schema.nullable().optional(),
  is_published: z.boolean(),
  updated_at: z.string(),
});
export type CmsPage = z.infer<typeof cmsPageSchema>;

export const pageTemplateRules: Record<z.infer<typeof pageTemplateSchema>, { allowed: ContentBlock['type'][]; required: ContentBlock['type'][] }> = {
  home: { allowed: ['hero', 'area_guide', 'card_grid', 'notice', 'image_text', 'link_list', 'news_feed', 'calendar_feed', 'document_list', 'search_teaser', 'faq', 'rich_text','heading','image','button','divider','spacer','approved_embed'], required: ['hero'] },
  standard: { allowed: ['hero', 'rich_text', 'card_grid', 'notice', 'image_text', 'link_list', 'faq', 'news_feed', 'calendar_feed', 'document_list', 'search_teaser','heading','image','button','divider','spacer','approved_embed'], required: [] },
  article: { allowed: ['hero', 'rich_text', 'notice', 'image_text', 'link_list', 'faq','heading','image','button','divider','spacer','approved_embed'], required: ['rich_text'] },
  documents: { allowed: ['hero', 'rich_text', 'notice', 'document_list', 'link_list','heading','image','button','divider','spacer'], required: ['document_list'] },
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
