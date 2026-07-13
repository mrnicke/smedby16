import { z } from 'npm:zod@4';
import { editorDocumentV2Schema } from '../../../src/lib/cms/schema.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { requireCapability, type Capability } from '../_shared/auth.ts';

const inputSchema = z.object({ resource: z.enum(['template','component','global_layout']), action: z.enum(['create','update','archive','publish','usage']), id: z.string().uuid().optional(), payload: z.record(z.string(),z.unknown()).default({}) });
const templateSchema = z.object({ name:z.string().min(1).max(120), description:z.string().max(500).default(''), template_type:z.enum(['page','news']), editor_document:editorDocumentV2Schema, thumbnail_media_id:z.string().uuid().nullable().optional(), locked_node_ids:z.array(z.string().uuid()).default([]), editable_fields:z.record(z.string(),z.unknown()).default({}) });
const componentSchema = z.object({ name:z.string().min(1).max(120), component_type:z.string().min(1).max(80), published_definition:z.record(z.string(),z.unknown()), allowed_instance_properties:z.record(z.string(),z.unknown()).default({}), version:z.number().int().positive().default(1) });
const layoutSchema = z.object({ layout_type:z.enum(['header','navigation','footer','design_system']), editor_document:editorDocumentV2Schema });
const config = { template:{table:'editor_templates',capability:'manage_templates',schema:templateSchema}, component:{table:'reusable_components',capability:'manage_components',schema:componentSchema}, global_layout:{table:'global_layouts',capability:'manage_global_layouts',schema:layoutSchema} } as const;

Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:corsHeaders(request)});
  try {
    const input=inputSchema.parse(await request.json()); const definition=config[input.resource]; const {service,user}=await requireCapability(request,definition.capability as Capability);
    if(input.action==='usage' && input.resource==='component') { const [{data:pages},{data:news}]=await Promise.all([service.from('pages').select('id,title,slug,editor_document'),service.from('news_posts').select('id,title,slug,editor_document')]); const used=(item:any)=>JSON.stringify(item.editor_document??{}).includes(input.id!);return json(request,{data:[...(pages??[]).filter(used).map(({editor_document:_document,...item})=>({...item,entity:'page'})),...(news??[]).filter(used).map(({editor_document:_document,...item})=>({...item,entity:'news'}))]}); }
    if(!input.id && input.action!=='create') return json(request,{error:'Innehållet kunde inte hittas.'},404);
    if(input.action==='archive') { if(input.resource==='component'){const [{data:pages},{data:news}]=await Promise.all([service.from('pages').select('editor_document'),service.from('news_posts').select('editor_document')]);if([...(pages??[]),...(news??[])].some(item=>JSON.stringify(item.editor_document??{}).includes(input.id!)))return json(request,{error:'Komponenten används fortfarande och kan inte arkiveras.'},409);} const mutation=input.resource==='template'?{active:false,archived_at:new Date().toISOString(),updated_by:user.id}:{archived_at:new Date().toISOString(),updated_by:user.id};const {data,error}=await service.from(definition.table).update(mutation).eq('id',input.id).select().single();if(error)throw error;return json(request,{data}); }
    const payload=(definition.schema as z.ZodTypeAny).parse(input.payload) as Record<string,unknown>; Object.assign(payload,{updated_by:user.id});
    if(input.action==='publish' && input.resource==='component') Object.assign(payload,{is_published:true,version:Number(payload.version)+1});
    if(input.action==='publish' && input.resource==='global_layout') Object.assign(payload,{is_published:true});
    if(input.action==='create') Object.assign(payload,{created_by:user.id});
    const query=input.action==='create'?service.from(definition.table).insert(payload):service.from(definition.table).update(payload).eq('id',input.id!); const {data,error}=await query.select().single();if(error)throw error;return json(request,{data});
  } catch(error) { if(error instanceof Response)return new Response(await error.text(),{status:error.status,headers:corsHeaders(request)});if(error instanceof z.ZodError)return json(request,{error:'Kontrollera de markerade fälten.'},400);console.error('editor-library failed',error instanceof Error?error.message:'unknown');return json(request,{error:'Biblioteket kunde inte uppdateras.'},500); }
});
