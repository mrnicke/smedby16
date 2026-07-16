import { z } from 'npm:zod@4';
import { json } from '../_shared/cors.ts';
import { requireCapability } from '../_shared/auth.ts';
import { enforceMethod,handlePreflight,parseJson,passthroughError } from '../_shared/http.ts';
const schema=z.object({action:z.enum(['acquire','heartbeat','release']),entityType:z.enum(['page','news','global_layout']),entityId:z.string().uuid(),lockToken:z.string().uuid().optional()});
Deno.serve(async(request)=>{
  const preflight=handlePreflight(request,['POST']);if(preflight)return preflight;
  const methodError=enforceMethod(request,['POST']);if(methodError)return methodError;
  try{
    const input=await parseJson(request,schema);
    const capability=input.entityType==='page'?'edit_pages':input.entityType==='news'?'edit_news':'manage_global_layouts';
    const {service,user}=await requireCapability(request,capability);
    const {data:current}=await service.from('content_locks').select('*').eq('entity_type',input.entityType).eq('entity_id',input.entityId).maybeSingle();
    if(input.action==='acquire'){
      if(current&&current.user_id!==user.id&&new Date(current.expires_at)>new Date())return json(request,{error:'Sidan redigeras av någon annan och öppnas skrivskyddad.',lock:{expires_at:current.expires_at}},409);
      const token=crypto.randomUUID();const now=new Date();
      const {data,error}=await service.from('content_locks').upsert({entity_type:input.entityType,entity_id:input.entityId,user_id:user.id,lock_token:token,acquired_at:now.toISOString(),heartbeat_at:now.toISOString(),expires_at:new Date(now.getTime()+120000).toISOString()},{onConflict:'entity_type,entity_id'}).select().single();
      if(error)throw error;return json(request,{data});
    }
    if(!current||current.user_id!==user.id||current.lock_token!==input.lockToken)return json(request,{error:'Redigeringslåset gäller inte längre.'},409);
    if(input.action==='release'){await service.from('content_locks').delete().eq('lock_token',input.lockToken);return json(request,{data:{released:true}});}
    const now=new Date();const {data,error}=await service.from('content_locks').update({heartbeat_at:now.toISOString(),expires_at:new Date(now.getTime()+120000).toISOString()}).eq('lock_token',input.lockToken).select().single();
    if(error)throw error;return json(request,{data});
  }catch(error){if(error instanceof Response)return passthroughError(request,error);if(error instanceof z.ZodError)return json(request,{error:'Ogiltig begäran.'},400);return json(request,{error:'Redigeringslåset kunde inte uppdateras.'},500);}
});
