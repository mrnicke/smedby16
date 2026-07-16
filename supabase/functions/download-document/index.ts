import { createClient } from 'npm:@supabase/supabase-js@2';
import { json } from '../_shared/cors.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { enforceMethod,handlePreflight } from '../_shared/http.ts';

Deno.serve(async(request)=>{
  const preflight=handlePreflight(request,['GET']);if(preflight)return preflight;const methodError=enforceMethod(request,['GET']);if(methodError)return methodError;
  const id=new URL(request.url).searchParams.get('id');if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return json(request,{error:'Dokumentet kunde inte hittas.'},404);
  const url=Deno.env.get('SUPABASE_URL');const key=Deno.env.get('SUPABASE_ANON_KEY');if(!url||!key)return json(request,{error:'Dokumentet är tillfälligt otillgängligt.'},503);
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const document=await client.from('public_documents').select('id,title,storage_path').eq('id',id).maybeSingle();if(document.error||!document.data)return json(request,{error:'Dokumentet kunde inte hittas.'},404);
  const file=await client.storage.from('public-media').download(document.data.storage_path);if(file.error||!file.data)return json(request,{error:'Dokumentet är tillfälligt otillgängligt.'},503);const filename=`${document.data.title.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100)||'dokument'}.pdf`;
  return new Response(file.data,{headers:{...corsHeaders(request,['GET']),'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${filename}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300','Cross-Origin-Resource-Policy':'same-site'}});
});
