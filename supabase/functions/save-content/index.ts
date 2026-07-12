import { z } from 'npm:zod@4';
import { blockListSchema, pageTemplateSchema, validatePageBlocks } from '../../../src/lib/cms/schema.ts';
import { invalidInternalHrefs } from '../../../src/lib/cms/links.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';

const uuid = z.string().uuid();
const optionalUuid = uuid.nullable().optional();
const schemas = {
  pages: z.object({ id: uuid, page_key: z.string().regex(/^[a-z0-9-]+$/), slug: z.string(), template: pageTemplateSchema, title: z.string().min(1).max(160), seo_title: z.string().max(200).nullable().optional(), seo_description: z.string().max(320).nullable().optional(), social_media_id: optionalUuid, blocks: blockListSchema, is_published: z.boolean() }),
  news_posts: z.object({ id: uuid.optional(), slug: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1).max(160), summary: z.string().max(600).default(''), body_blocks: blockListSchema, hero_media_id: optionalUuid, published_at: z.string().datetime().nullable(), is_published: z.boolean(), archived_at: z.string().datetime().nullable().optional() }),
  calendar_events: z.object({ id: uuid.optional(), title: z.string().min(1).max(160), description: z.string().max(2500).default(''), starts_at: z.string().datetime(), ends_at: z.string().datetime().nullable().optional(), all_day: z.boolean(), location: z.string().max(240).nullable().optional(), category: z.enum(['möte','aktivitet','underhåll','information']), external_url: z.string().url().startsWith('https://').nullable().optional(), is_published: z.boolean(), archived_at: z.string().datetime().nullable().optional() }),
  documents: z.object({ id: uuid.optional(), title: z.string().min(1).max(160), description: z.string().max(1000).default(''), document_date: z.string().date().nullable().optional(), category: z.string().min(1).max(80), media_id: uuid, is_published: z.boolean(), sort_order: z.number().int(), archived_at: z.string().datetime().nullable().optional() }),
  media_assets: z.object({ id: uuid.optional(), storage_path: z.string().min(3).max(500), original_name: z.string().min(1).max(255), mime_type: z.enum(['image/jpeg','image/png','image/webp','image/avif','application/pdf']), size_bytes: z.number().int().positive().max(26214400), width: z.number().int().positive().nullable().optional(), height: z.number().int().positive().nullable().optional(), alt_text: z.string().max(240).default('') }),
  navigation_items: z.object({ id: uuid.optional(), label: z.string().min(1).max(120), target_page_key: z.string().nullable().optional(), external_url: z.string().url().startsWith('https://').nullable().optional(), sort_order: z.number().int(), visible: z.boolean() }).refine((value) => Boolean(value.target_page_key) !== Boolean(value.external_url), 'Välj exakt ett länkmål.'),
  site_settings: z.object({ id: z.literal(true), site_name: z.string().min(1).max(120), contact_email: z.string().email().nullable().optional(), footer_text: z.string().min(1).max(1000), default_seo_title: z.string().min(1).max(200), default_seo_description: z.string().min(1).max(320), social_media_id: optionalUuid }),
} as const;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Metoden stöds inte.' }, 405);
  try {
    const { service, user } = await requireAdmin(request);
    const input = await request.json();
    const entity = String(input.entity) as keyof typeof schemas;
    if (!(entity in schemas)) return json(request, { error: 'Innehållstypen stöds inte.' }, 400);
    const payload = (schemas[entity] as z.ZodTypeAny).parse(input.payload) as Record<string, unknown>;
    if (entity === 'pages') validatePageBlocks(payload.template as any, payload.blocks as any);
    if (entity === 'pages' || entity === 'news_posts') {
      const { data: routes, error: routeError } = await service.from('pages').select('slug');
      if (routeError) throw routeError;
      const invalidLinks = invalidInternalHrefs(entity === 'pages' ? payload.blocks : payload.body_blocks, (routes ?? []).map((route) => route.slug));
      if (invalidLinks.length) return json(request, { error: `Okända interna länkar: ${invalidLinks.join(', ')}` }, 400);
    }
    if (['news_posts','calendar_events','documents'].includes(entity) && payload.archived_at) return json(request, { error: 'Återställ arkiverat innehåll innan det redigeras.' }, 409);
    payload.updated_by = user.id;
    if (!payload.id && entity !== 'navigation_items') payload.created_by = user.id;
    const query = payload.id ? service.from(entity).update(payload).eq('id', payload.id) : service.from(entity).insert(payload);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return json(request, { data });
  } catch (error) {
    if (error instanceof Response) return new Response(await error.text(), { status: error.status, headers: { ...corsHeaders(request), 'Content-Type': 'text/plain; charset=utf-8' } });
    if (error instanceof z.ZodError) return json(request, { error: 'Kontrollera de markerade fälten.', fields: error.flatten().fieldErrors }, 400);
    console.error('save-content failed', error instanceof Error ? error.message : 'unknown');
    return json(request, { error: 'Innehållet kunde inte sparas just nu.' }, 500);
  }
});
