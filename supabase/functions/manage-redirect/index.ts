import { z } from 'npm:zod@4';
import { json } from '../_shared/cors.ts';
import { requireCapability } from '../_shared/auth.ts';
import { enforceMethod,handlePreflight,parseJson,passthroughError } from '../_shared/http.ts';
const schema=z.object({oldPath:z.string().regex(/^\/[a-z0-9\-/]*\/$|^\/$/),newPath:z.string().regex(/^\/[a-z0-9\-/]*\/$|^\/$/)}).refine(value=>value.oldPath!==value.newPath,'Adresserna måste vara olika.');
Deno.serve(async(request)=>{
  const preflight=handlePreflight(request,['POST']);if(preflight)return preflight;
  const methodError=enforceMethod(request,['POST']);if(methodError)return methodError;
  try{
    const input=await parseJson(request,schema);const {service,user}=await requireCapability(request,'publish_pages');
    const {data:target}=await service.from('pages').select('id').eq('slug',input.newPath).eq('is_published',true).is('archived_at',null).maybeSingle();
    if(!target)return json(request,{error:'Målsidan saknas eller är arkiverad.'},400);
    const {data:chain}=await service.from('content_redirects').select('old_path,new_path').eq('active',true);let cursor=input.newPath;const seen=new Set([input.oldPath]);
    for(let i=0;i<20;i++){if(seen.has(cursor))return json(request,{error:'Redirecten skulle skapa en loop.'},400);seen.add(cursor);const next=(chain??[]).find(item=>item.old_path===cursor)?.new_path;if(!next)break;cursor=next;}
    const {data,error}=await service.from('content_redirects').upsert({old_path:input.oldPath,new_path:input.newPath,active:true,created_by:user.id},{onConflict:'old_path'}).select().single();
    if(error)throw error;return json(request,{data});
  }catch(error){if(error instanceof Response)return passthroughError(request,error);if(error instanceof z.ZodError)return json(request,{error:'Adressen är inte giltig.'},400);return json(request,{error:'Redirecten kunde inte sparas.'},500);}
});
