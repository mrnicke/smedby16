import { z } from 'npm:zod@4';
import { blockListSchema, pageTemplateSchema, validatePageBlocks } from '../_shared/cms-schema.ts';
import { invalidInternalHrefs } from '../_shared/cms-links.ts';
import { json } from '../_shared/cors.ts';
import { requireCapability, type Capability } from '../_shared/auth.ts';
import { enforceMethod, handlePreflight, parseJson, passthroughError } from '../_shared/http.ts';

const uuid = z.string().uuid();
const optionalUuid = uuid.nullable().optional();
const schemas = {
  pages: z.object({ id: uuid, page_key: z.string().regex(/^[a-z0-9-]+$/), slug: z.string(), template: pageTemplateSchema, title: z.string().min(1).max(160), seo_title: z.string().max(200).nullable().optional(), seo_description: z.string().max(320).nullable().optional(), social_media_id: optionalUuid, blocks: blockListSchema, is_published: z.boolean() }),
  news_posts: z.object({ id: uuid.optional(), slug: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1).max(160), summary: z.string().max(600).default(''), body_blocks: blockListSchema, hero_media_id: optionalUuid, published_at: z.string().datetime().nullable(), is_published: z.boolean(), archived_at: z.string().datetime().nullable().optional() }),
  calendar_events: z.object({ id: uuid.optional(), title: z.string().min(1).max(160), description: z.string().max(2500).default(''), starts_at: z.string().datetime(), ends_at: z.string().datetime().nullable().optional(), all_day: z.boolean(), location: z.string().max(240).nullable().optional(), category: z.enum(['möte','aktivitet','underhåll','information']), external_url: z.string().url().startsWith('https://').nullable().optional(), is_published: z.boolean(), archived_at: z.string().datetime().nullable().optional() }),
  documents: z.object({ id: uuid.optional(), title: z.string().min(1).max(160), description: z.string().max(1000).default(''), document_date: z.string().date().nullable().optional(), category: z.string().min(1).max(80), media_id: uuid, is_published: z.boolean(), sort_order: z.number().int(), archived_at: z.string().datetime().nullable().optional() }),
  media_assets: z.object({ id: uuid, alt_text: z.string().max(240) }).strict(),
  navigation_items: z.object({ id: uuid.optional(), label: z.string().min(1).max(120), target_page_key: z.string().nullable().optional(), external_url: z.string().url().startsWith('https://').nullable().optional(), sort_order: z.number().int(), visible: z.boolean() }).refine((value) => Boolean(value.target_page_key) !== Boolean(value.external_url), 'Välj exakt ett länkmål.'),
  site_settings: z.object({ id: z.literal(true), site_name: z.string().min(1).max(120), contact_email: z.string().email().nullable().optional(), footer_text: z.string().min(1).max(1000), default_seo_title: z.string().min(1).max(200), default_seo_description: z.string().min(1).max(320), social_media_id: optionalUuid }),
} as const;
const envelopeSchema = z.object({ entity: z.enum(['pages','news_posts','calendar_events','documents','media_assets','navigation_items','site_settings']), payload: z.unknown() }).strict();

function capabilityFor(entity: keyof typeof schemas, payload: Record<string, unknown>): Capability {
  if (entity === 'pages') return payload.is_published ? 'publish_pages' : 'edit_pages';
  if (entity === 'news_posts') return payload.is_published ? 'publish_news' : 'edit_news';
  if (entity === 'calendar_events') return 'manage_calendar';
  if (entity === 'documents') return 'manage_documents';
  if (entity === 'media_assets') return 'manage_media';
  if (entity === 'navigation_items') return 'manage_navigation';
  return 'manage_settings';
}

Deno.serve(async (request) => {
  const preflight = handlePreflight(request, ['POST']); if (preflight) return preflight;
  const methodError = enforceMethod(request, ['POST']); if (methodError) return methodError;
  try {
    const input = await parseJson(request, envelopeSchema, 262_144);
    const entity = input.entity as keyof typeof schemas;
    const rawPayload = input.payload && typeof input.payload === 'object' ? input.payload as Record<string, unknown> : {};
    const { service, user } = await requireCapability(request, capabilityFor(entity, rawPayload));
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
    if (entity === 'media_assets') {
      const { data, error } = await service
        .from('media_assets')
        .update({ alt_text: payload.alt_text, updated_by: user.id })
        .eq('id', payload.id)
        .is('deleted_at', null)
        .select()
        .single();
      if (error) throw error;
      return json(request, { data });
    }
    if (!payload.id && entity !== 'navigation_items') payload.created_by = user.id;
    const query = payload.id ? service.from(entity).update(payload).eq('id', payload.id) : service.from(entity).insert(payload);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return json(request, { data });
  } catch (error) {
    if (error instanceof Response) return passthroughError(request, error);
    if (error instanceof z.ZodError) return json(request, { error: 'Kontrollera de markerade fälten.', fields: error.flatten().fieldErrors }, 400);
    console.error('save-content failed', error instanceof Error ? error.message : 'unknown');
    return json(request, { error: 'Innehållet kunde inte sparas just nu.' }, 500);
  }
});
