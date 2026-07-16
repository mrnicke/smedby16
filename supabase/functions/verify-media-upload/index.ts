import { z } from 'npm:zod@4';
import { json } from '../_shared/cors.ts';
import { requireCapability } from '../_shared/auth.ts';
import { enforceMethod,handlePreflight,parseJson,passthroughError } from '../_shared/http.ts';

const schema=z.object({path:z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.upload$/),originalName:z.string().trim().min(1).max(255).refine((value)=>!/[\\/\u0000-\u001f\u007f]/.test(value),'Ogiltigt filnamn.'),kind:z.enum(['image','pdf']),altText:z.string().trim().max(240).default('')}).strict();
const MAX_BYTES=26_214_400;const decoder=new TextDecoder('latin1');
function u16le(bytes:Uint8Array,offset:number){return bytes[offset]|bytes[offset+1]<<8;}
function u24le(bytes:Uint8Array,offset:number){return bytes[offset]|bytes[offset+1]<<8|bytes[offset+2]<<16;}
function u32be(bytes:Uint8Array,offset:number){return (bytes[offset]*0x1000000)+(bytes[offset+1]<<16)+(bytes[offset+2]<<8)+bytes[offset+3];}
function imageType(bytes:Uint8Array){
  if(bytes.length>=24&&bytes.slice(0,8).every((value,index)=>value===[137,80,78,71,13,10,26,10][index])&&bytes.slice(-12).every((value,index)=>value===[0,0,0,0,73,69,78,68,174,66,96,130][index]))return{mime:'image/png',ext:'png',width:u32be(bytes,16),height:u32be(bytes,20)};
  if(bytes.length>=16&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff&&bytes.at(-2)===0xff&&bytes.at(-1)===0xd9){for(let offset=2;offset+9<bytes.length;){if(bytes[offset]!==0xff){offset++;continue;}const marker=bytes[offset+1];if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{mime:'image/jpeg',ext:'jpg',height:bytes[offset+5]<<8|bytes[offset+6],width:bytes[offset+7]<<8|bytes[offset+8]};const length=bytes[offset+2]<<8|bytes[offset+3];if(length<2)break;offset+=2+length;}}
  if(bytes.length>=30&&decoder.decode(bytes.slice(0,4))==='RIFF'&&decoder.decode(bytes.slice(8,12))==='WEBP'){const declared=(bytes[4]|bytes[5]<<8|bytes[6]<<16|bytes[7]<<24)>>>0;if(declared+8!==bytes.length)return null;const chunk=decoder.decode(bytes.slice(12,16));if(chunk==='VP8X')return{mime:'image/webp',ext:'webp',width:u24le(bytes,24)+1,height:u24le(bytes,27)+1};if(chunk==='VP8 '&&bytes[23]===0x9d&&bytes[24]===0x01&&bytes[25]===0x2a)return{mime:'image/webp',ext:'webp',width:u16le(bytes,26)&0x3fff,height:u16le(bytes,28)&0x3fff};if(chunk==='VP8L'&&bytes[20]===0x2f)return{mime:'image/webp',ext:'webp',width:1+((bytes[21]|bytes[22]<<8)&0x3fff),height:1+(((bytes[22]>>6)|(bytes[23]<<2)|(bytes[24]<<10))&0x3fff)};}
  return null;
}
function isPdf(bytes:Uint8Array){if(bytes.length<16||decoder.decode(bytes.slice(0,5))!=='%PDF-')return false;const tail=decoder.decode(bytes.slice(-1024));if(!tail.includes('%%EOF'))return false;const text=decoder.decode(bytes).toLowerCase();return !['/javascript','/js','/launch','/openaction','/embeddedfile','/richmedia','/xfa'].some((token)=>text.includes(token));}

Deno.serve(async(request)=>{
  const preflight=handlePreflight(request,['POST']);if(preflight)return preflight;const methodError=enforceMethod(request,['POST']);if(methodError)return methodError;
  try{
    const input=await parseJson(request,schema);const {service,user}=await requireCapability(request,'manage_media');if(!input.path.startsWith(`${user.id}/`))return json(request,{error:'Filsökvägen är inte tillåten.'},403);if(input.kind==='image'&&!input.altText)return json(request,{error:'Bilder måste ha en bildbeskrivning.'},400);
    const downloaded=await service.storage.from('media-quarantine').download(input.path);if(downloaded.error||!downloaded.data)return json(request,{error:'Filen kunde inte hittas i karantänen.'},404);if(downloaded.data.size<=0||downloaded.data.size>MAX_BYTES)return json(request,{error:'Filen är för stor eller tom.'},400);
    const bytes=new Uint8Array(await downloaded.data.arrayBuffer());let detected:{mime:string;ext:string;width?:number;height?:number}|null=null;
    if(input.kind==='image'){detected=imageType(bytes);if(!detected||!detected.width||!detected.height||detected.width>12000||detected.height>12000||detected.width*detected.height>60_000_000)return json(request,{error:'Bildens verkliga format eller dimensioner stöds inte.'},400);}else{
      if(!isPdf(bytes))return json(request,{error:'PDF-filen är felmärkt eller innehåller aktiva funktioner.'},400);const scanUrl=Deno.env.get('DOCUMENT_SCAN_URL');const scanToken=Deno.env.get('DOCUMENT_SCAN_TOKEN');if(!scanUrl||!scanToken||new URL(scanUrl).protocol!=='https:')return json(request,{error:'Dokumentskanning är inte konfigurerad. Filen ligger kvar i karantän.'},503);const scan=await fetch(scanUrl,{method:'POST',headers:{Authorization:`Bearer ${scanToken}`,'Content-Type':'application/pdf'},body:bytes});if(!scan.ok)return json(request,{error:'Dokumentskanningen kunde inte slutföras.'},503);const verdict=await scan.json().catch(()=>null) as {clean?:boolean}|null;if(!verdict?.clean)return json(request,{error:'Dokumentet godkändes inte av säkerhetsskanningen.'},400);detected={mime:'application/pdf',ext:'pdf'};
    }
    if(!detected)throw new Error('file type missing');const storagePath=`${input.kind==='pdf'?'documents':'images'}/${crypto.randomUUID()}.${detected.ext}`;const uploaded=await service.storage.from('public-media').upload(storagePath,bytes,{contentType:detected.mime,cacheControl:'3600',upsert:false});if(uploaded.error)throw uploaded.error;
    const saved=await service.from('media_assets').insert({storage_path:storagePath,original_name:input.originalName,mime_type:detected.mime,size_bytes:bytes.byteLength,width:detected.width??null,height:detected.height??null,alt_text:input.altText,created_by:user.id,updated_by:user.id}).select().single();if(saved.error){await service.storage.from('public-media').remove([storagePath]);throw saved.error;}
    await service.storage.from('media-quarantine').remove([input.path]);await service.from('security_audit_log').insert({actor_id:user.id,action:'media.verified',target_type:'media_asset',target_id:saved.data.id,outcome:'success',metadata:{mime_type:detected.mime,size_bytes:bytes.byteLength}});
    return json(request,{data:saved.data});
  }catch(error){if(error instanceof Response)return passthroughError(request,error);if(error instanceof z.ZodError)return json(request,{error:'Kontrollera filuppgifterna.'},400);console.error('verify-media-upload failed');return json(request,{error:'Filen kunde inte verifieras.'},500);}
});
