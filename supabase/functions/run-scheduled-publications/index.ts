import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@4';
import { json } from '../_shared/cors.ts';
import { enforceMethod,handlePreflight,parseJsonText,passthroughError,readJsonText } from '../_shared/http.ts';
import { verifyWebhookSignature } from '../_shared/webhook.ts';
import { editorDocumentV2Schema } from '../_shared/cms-schema.ts';
import { hasBlockingQualityIssues,validateEditorQuality } from '../_shared/cms-quality.ts';
import { validatePublishedComponentInstances } from '../_shared/editor-validation.ts';

const schema=z.object({requestedAt:z.string().datetime().optional()}).strict();
const MAX_ATTEMPTS=3;

Deno.serve(async(request)=>{
  const preflight=handlePreflight(request,['POST']);if(preflight)return preflight;
  const methodError=enforceMethod(request,['POST']);if(methodError)return methodError;
  try{
    const raw=await readJsonText(request,4096);const input=parseJsonText(raw,schema);void input;
    const secret=Deno.env.get('CRON_WEBHOOK_SECRET');const url=Deno.env.get('SUPABASE_URL');const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!secret||!url||!serviceKey)return json(request,{error:'Serverkonfiguration saknas.'},503);
    const nonce=await verifyWebhookSignature(request,raw,secret);if(!nonce)return json(request,{error:'Ogiltig signatur.'},401);
    const service=createClient(url,serviceKey,{auth:{persistSession:false}});
    await service.from('security_webhook_nonces').delete().lt('received_at',new Date(Date.now()-10*60_000).toISOString());
    const {error:nonceError}=await service.from('security_webhook_nonces').insert({purpose:'scheduled_publications',signature_hash:nonce});
    if(nonceError)return json(request,{error:'Begäran har redan behandlats.'},409);
    const cutoff=new Date(Date.now()-15*60_000).toISOString();
    const {data:stuck}=await service.from('scheduled_publications').select('id,attempts').eq('status','processing').lt('updated_at',cutoff).limit(50);
    let recovered=0;
    for(const job of stuck??[]){const exhausted=job.attempts>=MAX_ATTEMPTS;await service.from('scheduled_publications').update(exhausted?{status:'failed',processed_at:new Date().toISOString(),error_summary:'Maximalt antal försök uppnåddes.'}:{status:'pending',error_summary:'Ett avbrutet försök återställdes.'}).eq('id',job.id).eq('status','processing');if(!exhausted)recovered++;}
    const {data:jobs,error}=await service.from('scheduled_publications').select('*').eq('status','pending').lt('attempts',MAX_ATTEMPTS).lte('execute_at',new Date().toISOString()).limit(50);if(error)throw error;
    let processed=0;let failed=0;
    for(const job of jobs??[]){
      const claimed=await service.from('scheduled_publications').update({status:'processing',attempts:job.attempts+1,error_summary:null}).eq('id',job.id).eq('status','pending').select().maybeSingle();
      if(claimed.error)throw claimed.error;if(!claimed.data)continue;
      const table=job.entity_type==='page'?'pages':job.entity_type==='news'?'news_posts':null;
      if(!table){await service.from('scheduled_publications').update({status:'failed',processed_at:new Date().toISOString(),error_summary:'Innehållstypen stöds inte.'}).eq('id',job.id);failed++;continue;}
      try{
        const {data:published,error:publishedError}=await service.from(table).select('published_version').eq('id',job.entity_id).maybeSingle();
        if(publishedError)throw publishedError;if(!published)throw new Error('content_missing');
        let draftVersion:number|null=null;
        if(job.action==='publish'){
          const {data:draft,error:draftError}=await service.from('content_drafts').select('snapshot,draft_version,base_published_version').eq('entity_type',job.entity_type).eq('entity_id',job.entity_id).maybeSingle();
          if(draftError)throw draftError;if(!draft||draft.base_published_version!==published.published_version)throw new Error('draft_conflict');
          const document=editorDocumentV2Schema.parse(draft.snapshot);await validatePublishedComponentInstances(service,document);
          const issues=validateEditorQuality(document,{externalH1:job.entity_type==='news'});if(hasBlockingQualityIssues(issues))throw new Error('quality_blocked');
          draftVersion=draft.draft_version;
        }
        const {error:applyError}=await service.rpc('apply_scheduled_publication',{p_job_id:job.id,p_expected_published_version:published.published_version,p_expected_draft_version:draftVersion});
        if(applyError)throw applyError;processed++;
      }catch{
        await service.from('scheduled_publications').update({status:'failed',processed_at:new Date().toISOString(),error_summary:'Publiceringen stoppades av versions-, lås- eller kvalitetskontrollen.'}).eq('id',job.id);
        failed++;
      }
    }
    return json(request,{data:{processed,failed,recovered}});
  }catch(error){if(error instanceof Response)return passthroughError(request,error);console.error('scheduler failed');return json(request,{error:'Schemaläggningen kunde inte köras.'},500);}
});
