import { z } from 'npm:zod@4';
import { editorDocumentV2Schema } from '../_shared/cms-schema.ts';
import { hasBlockingQualityIssues, validateEditorQuality } from '../_shared/cms-quality.ts';
import { validatePublishedComponentInstances } from '../_shared/editor-validation.ts';
import { json } from '../_shared/cors.ts';
import { requireCapability, type Capability } from '../_shared/auth.ts';
import { enforceMethod, handlePreflight, parseJson, passthroughError } from '../_shared/http.ts';

const entitySchema = z.enum(['page','news','global_layout']);
const schedulableEntitySchema = z.enum(['page','news']);
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action:z.literal('create_page'), entityType:z.literal('page'), title:z.string().min(1).max(160), slug:z.string().regex(/^\/[a-z0-9\-/]*\/$|^\/$/), templateId:z.string().uuid().optional() }),
  z.object({ action:z.literal('update_page_settings'), entityType:z.literal('page'), entityId:z.string().uuid(), expectedPublishedVersion:z.number().int().positive(), title:z.string().min(1).max(160), slug:z.string().regex(/^\/[a-z0-9\-/]*\/$|^\/$/), seoTitle:z.string().max(200).nullable(), seoDescription:z.string().max(320).nullable(), socialMediaId:z.string().uuid().nullable() }),
  z.object({ action:z.literal('preview'), entityType:entitySchema, entityId:z.string().uuid() }),
  z.object({ action:z.literal('autosave'), entityType:entitySchema, entityId:z.string().uuid(), document:editorDocumentV2Schema, expectedDraftVersion:z.number().int().nonnegative(), basePublishedVersion:z.number().int().positive(), lockToken:z.string().uuid() }),
  z.object({ action:z.literal('publish'), entityType:entitySchema, entityId:z.string().uuid(), expectedDraftVersion:z.number().int().positive(), expectedPublishedVersion:z.number().int().positive(), lockToken:z.string().uuid() }),
  z.object({ action:z.literal('unpublish'), entityType:entitySchema, entityId:z.string().uuid(), expectedPublishedVersion:z.number().int().positive() }),
  z.object({ action:z.literal('archive'), entityType:z.literal('page'), entityId:z.string().uuid(), expectedPublishedVersion:z.number().int().positive() }),
  z.object({ action:z.literal('schedule'), entityType:schedulableEntitySchema, entityId:z.string().uuid(), publicationAction:z.enum(['publish','unpublish']), executeAt:z.string().datetime() }),
]);
const tableFor = (type:'page'|'news'|'global_layout') => type === 'page' ? 'pages' : type === 'news' ? 'news_posts' : 'global_layouts';
const capabilityFor = (type:'page'|'news'|'global_layout', publish=false): Capability => type==='global_layout'?'manage_global_layouts':`${publish ? 'publish' : 'edit'}_${type === 'page' ? 'pages' : 'news'}` as Capability;

Deno.serve(async (request) => {
  const preflight=handlePreflight(request,['POST']);if(preflight)return preflight;
  const methodError=enforceMethod(request,['POST']);if(methodError)return methodError;
  try {
    const input=await parseJson(request,requestSchema,262_144);
    const publishAction=['publish','unpublish','archive','schedule'].includes(input.action);
    const {service,user}=await requireCapability(request,capabilityFor(input.entityType,publishAction),{requireAal2:input.action!=='preview'});
    if(input.action==='create_page') {
      const staticRoutes=new Set(['/admin/','/kalender.ics/']);if(staticRoutes.has(input.slug))return json(request,{error:'Adressen används av en fast sida.'},400);
      let document=editorDocumentV2Schema.parse({version:2,root:[{id:crypto.randomUUID(),type:'section',variant:'default',width:'normal',spacing:'normal',columns:[{id:crypto.randomUUID(),type:'column',width:1,blocks:[{id:crypto.randomUUID(),type:'hero',heading:input.title,text:''}]}]}]});
      if(input.templateId){const {data:template}=await service.from('editor_templates').select('editor_document').eq('id',input.templateId).eq('active',true).is('archived_at',null).maybeSingle();if(!template)return json(request,{error:'Mallen kunde inte hittas.'},404);const rekey=(value:any):any=>Array.isArray(value)?value.map(rekey):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='id'?crypto.randomUUID():rekey(item)])):value;document=editorDocumentV2Schema.parse(rekey(template.editor_document));}
      const pageKey=(input.slug.replace(/^\/+|\/+$/g,'').replaceAll('/','-')||`page-${crypto.randomUUID().slice(0,8)}`);
      const {data,error}=await service.from('pages').insert({page_key:pageKey,slug:input.slug,template:'standard',title:input.title,blocks:[],editor_version:2,editor_document:document,is_published:false,created_by:user.id,updated_by:user.id}).select().single();if(error?.code==='23505')return json(request,{error:'Sidans adress används redan.'},409);if(error)throw error;return json(request,{data});
    }
    if(input.action==='update_page_settings') {
      const {data,error}=await service.rpc('update_page_settings_with_redirect',{p_entity_id:input.entityId,p_expected_version:input.expectedPublishedVersion,p_title:input.title,p_slug:input.slug,p_seo_title:input.seoTitle,p_seo_description:input.seoDescription,p_social_media_id:input.socialMediaId,p_actor:user.id});
      if(error?.code==='40001')return json(request,{error:'Sidan har ändrats sedan du öppnade den. Ladda om och försök igen.'},409);
      if(error?.code==='23505')return json(request,{error:'Adressen används redan av en sida eller omdirigering.'},409);
      if(error?.code==='22023')return json(request,{error:'Kontrollera sidans titel och adress.'},400);
      if(error?.code==='P0002')return json(request,{error:'Sidan kunde inte hittas.'},404);
      if(error)throw error;return json(request,{data});
    }
    const table=tableFor(input.entityType);
    const {data:published,error:publishedError}=await service.from(table).select('*').eq('id',input.entityId).maybeSingle();
    if(publishedError) throw publishedError; if(!published) return json(request,{error:'Innehållet kunde inte hittas.'},404);
    if(input.action==='preview') {
      const [{data:draft},{data:lock},{data:components},{data:layouts}] = await Promise.all([
        service.from('content_drafts').select('*').eq('entity_type',input.entityType).eq('entity_id',input.entityId).maybeSingle(),
        service.from('content_locks').select('user_id,expires_at').eq('entity_type',input.entityType).eq('entity_id',input.entityId).maybeSingle(),
        service.from('reusable_components').select('id,name,version,published_definition,allowed_instance_properties').eq('is_published',true).is('archived_at',null),
        service.from('global_layouts').select('*').eq('is_published',true),
      ]); return json(request,{data:{published,draft,lock,components:components??[],globalLayouts:layouts??[]}});
    }
    if(input.action==='autosave'||input.action==='publish') {
      const {data:lock}=await service.from('content_locks').select('*').eq('entity_type',input.entityType).eq('entity_id',input.entityId).maybeSingle();
      if(!lock||lock.user_id!==user.id||lock.lock_token!==input.lockToken||new Date(lock.expires_at)<=new Date()) return json(request,{error:'Redigeringslåset har löpt ut. Ladda om sidan.'},409);
    }
    if(input.action==='autosave') {
      await validatePublishedComponentInstances(service,input.document);
      const {data:current}=await service.from('content_drafts').select('draft_version').eq('entity_type',input.entityType).eq('entity_id',input.entityId).maybeSingle();
      if((current?.draft_version??0)!==input.expectedDraftVersion) return json(request,{error:'Ett nyare utkast finns redan. Ladda om innan du fortsätter.'},409);
      const payload={entity_type:input.entityType,entity_id:input.entityId,snapshot:input.document,draft_version:input.expectedDraftVersion+1,base_published_version:input.basePublishedVersion,updated_by:user.id};
      const {data,error}=await service.from('content_drafts').upsert(payload,{onConflict:'entity_type,entity_id'}).select().single(); if(error) throw error; return json(request,{data});
    }
    if(input.action==='publish') {
      const currentPublishedVersion=input.entityType==='global_layout'?published.version:published.published_version;
      if(currentPublishedVersion!==input.expectedPublishedVersion) return json(request,{error:'Innehållet har ändrats sedan du öppnade det. Ladda om och jämför ändringarna.'},409);
      const {data:draft}=await service.from('content_drafts').select('*').eq('entity_type',input.entityType).eq('entity_id',input.entityId).maybeSingle();
      if(!draft||draft.draft_version!==input.expectedDraftVersion) return json(request,{error:'Utkastet är inte den senaste versionen.'},409);
      const document=editorDocumentV2Schema.parse(draft.snapshot);await validatePublishedComponentInstances(service,document); const issues=validateEditorQuality(document,{externalH1:input.entityType==='news',skipH1:input.entityType==='global_layout'});
      if(hasBlockingQualityIssues(issues)) return json(request,{error:'Åtgärda de markerade kvalitetsfelen före publicering.',issues},400);
      const mutation=input.entityType==='global_layout'?{editor_document:document,version:currentPublishedVersion+1,is_published:true,updated_by:user.id}:{editor_version:2,editor_document:document,published_version:currentPublishedVersion+1,is_published:true,archived_at:null,updated_by:user.id};
      const versionColumn=input.entityType==='global_layout'?'version':'published_version';
      const {data,error}=await service.from(table).update(mutation).eq('id',input.entityId).eq(versionColumn,input.expectedPublishedVersion).select().single(); if(error) throw error;
      await service.from('content_drafts').delete().eq('id',draft.id); return json(request,{data,issues});
    }
    if(input.action==='schedule') { const {data,error}=await service.from('scheduled_publications').insert({entity_type:input.entityType,entity_id:input.entityId,action:input.publicationAction,execute_at:input.executeAt,requested_by:user.id}).select().single(); if(error) throw error; return json(request,{data}); }
    const currentPublishedVersion=input.entityType==='global_layout'?published.version:published.published_version;
    if(currentPublishedVersion!==input.expectedPublishedVersion) return json(request,{error:'Innehållet har ändrats. Ladda om sidan.'},409);
    const mutation=input.action==='archive'?{is_published:false,archived_at:new Date().toISOString()}:{is_published:false};
    const versionMutation=input.entityType==='global_layout'?{...mutation,version:currentPublishedVersion+1,updated_by:user.id}:{...mutation,published_version:currentPublishedVersion+1,updated_by:user.id};
    const {data,error}=await service.from(table).update(versionMutation).eq('id',input.entityId).select().single(); if(error) throw error; return json(request,{data});
  } catch(error) {
    if(error instanceof Response) return passthroughError(request,error);
    if(error instanceof z.ZodError) return json(request,{error:'Kontrollera de markerade fälten.'},400);
    console.error('editor-content failed',error instanceof Error?error.message:'unknown'); return json(request,{error:'Åtgärden kunde inte genomföras just nu.'},500);
  }
});
