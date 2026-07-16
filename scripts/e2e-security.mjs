import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url=process.env.SUPABASE_URL;const anonKey=process.env.SUPABASE_ANON_KEY;const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!anonKey||!serviceKey)throw new Error('Lokala Supabase-miljövariabler krävs.');
const parsedUrl=new URL(url);if(!['127.0.0.1','localhost'].includes(parsedUrl.hostname))throw new Error('Säkerhetstestet får endast köras mot en lokal eller ephemeral Supabase-instans.');
const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});const prefix=`security-${Date.now()}-${randomBytes(3).toString('hex')}`;const password=`T!${randomBytes(24).toString('base64url')}`;const userIds=[];const pageIds=[];const newsIds=[];let userSequence=0;

function base32Decode(value){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const character of value.replace(/=+$/,'').toUpperCase())bits+=alphabet.indexOf(character).toString(2).padStart(5,'0');const bytes=[];for(let index=0;index+8<=bits.length;index+=8)bytes.push(Number.parseInt(bits.slice(index,index+8),2));return Buffer.from(bytes);}
function totp(secret){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30_000)));const digest=createHmac('sha1',base32Decode(secret)).update(counter).digest();const offset=digest[digest.length-1]&15;return String((digest.readUInt32BE(offset)&0x7fffffff)%1_000_000).padStart(6,'0');}
async function createUser(role,active=true){const email=`${prefix}-${role}-${++userSequence}@example.invalid`;const created=await service.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);userIds.push(created.data.user.id);const profile=await service.from('admin_profiles').insert({user_id:created.data.user.id,display_name:role,role,active});assert.ifError(profile.error);const client=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});const signed=await client.auth.signInWithPassword({email,password});assert.ifError(signed.error);return client;}
async function elevate(client){const enrollment=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'security-test'});assert.ifError(enrollment.error);const challenge=await client.auth.mfa.challenge({factorId:enrollment.data.id});assert.ifError(challenge.error);const verified=await client.auth.mfa.verify({factorId:enrollment.data.id,challengeId:challenge.data.id,code:totp(enrollment.data.totp.secret)});assert.ifError(verified.error);const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();assert.equal(assurance.data.currentLevel,'aal2');}
async function invoke(client,name,body){const result=await client.functions.invoke(name,{body});return {status:result.response?.status??0,data:result.data,error:result.error};}
async function verifyHttpContracts(){
  const functionsUrl=`${url.replace(/\/$/,'')}/functions/v1`;
  const unknownOrigin=await fetch(`${functionsUrl}/calendar-ics`,{method:'OPTIONS',headers:{origin:'https://attacker.invalid','access-control-request-method':'GET'}});
  const localKong=unknownOrigin.headers.has('x-kong-response-latency');
  if(localKong){assert.equal(unknownOrigin.status,200);assert.equal(unknownOrigin.headers.get('access-control-allow-origin'),'*');}
  else{assert.equal(unknownOrigin.status,403);assert.equal(unknownOrigin.headers.get('access-control-allow-origin'),null);}
  const allowedOrigin=await fetch(`${functionsUrl}/calendar-ics`,{method:'OPTIONS',headers:{origin:'http://127.0.0.1:4321','access-control-request-method':'GET'}});
  if(localKong){assert.equal(allowedOrigin.status,200);assert.equal(allowedOrigin.headers.get('access-control-allow-origin'),'*');console.log('Local Kong CORS interception detected; function-level origin policy is verified separately.');}
  else{assert.equal(allowedOrigin.status,204);assert.equal(allowedOrigin.headers.get('access-control-allow-origin'),'http://127.0.0.1:4321');}
  const wrongMethod=await fetch(`${functionsUrl}/calendar-ics`,{method:'POST'});assert.equal(wrongMethod.status,405);assert.match(wrongMethod.headers.get('allow')??'',/GET/);
  const wrongMediaType=await fetch(`${functionsUrl}/deployment-status`,{method:'POST',headers:{'content-type':'text/plain'},body:'{}'});assert.equal(wrongMediaType.status,415);
  const calendar=await fetch(`${functionsUrl}/calendar-ics`);assert.equal(calendar.status,200);assert.match(calendar.headers.get('content-type')??'',/text\/calendar/);
}

try{
  await verifyHttpContracts();
  const seeded=await service.from('pages').select('id').limit(1).single();assert.ifError(seeded.error);const pageId=seeded.data.id;
  const anonymous=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});const anonResult=await invoke(anonymous,'editor-content',{action:'preview',entityType:'page',entityId:pageId});assert.ok([401,403].includes(anonResult.status),`anon gav HTTP ${anonResult.status}`);
  const signup=await anonymous.auth.signUp({email:`${prefix}-signup@example.invalid`,password});if(signup.data.user)await service.auth.admin.deleteUser(signup.data.user.id);assert.ok(signup.error,'public signup är oväntat aktiverad');
  const inactive=await createUser('admin',false);const inactiveResult=await invoke(inactive,'editor-content',{action:'preview',entityType:'page',entityId:pageId});assert.equal(inactiveResult.status,403);
  const editor=await createUser('editor');await elevate(editor);const editorPage=await invoke(editor,'editor-content',{action:'create_page',entityType:'page',title:'Security editor page',slug:`/${prefix}-editor/`});assert.equal(editorPage.status,200);pageIds.push(editorPage.data.data.id);const editorAdminOnly=await invoke(editor,'manage-media',{id:crypto.randomUUID(),action:'usage'});assert.equal(editorAdminOnly.status,403);
  const editorNews=await invoke(editor,'save-content',{entity:'news_posts',payload:{slug:`${prefix}-news`,title:'Security editor news',summary:'Test',body_blocks:[],published_at:null,is_published:false}});assert.equal(editorNews.status,200);newsIds.push(editorNews.data.data.id);
  const admin=await createUser('admin');await elevate(admin);const adminPage=await invoke(admin,'editor-content',{action:'create_page',entityType:'page',title:'Security admin page',slug:`/${prefix}-admin/`});assert.equal(adminPage.status,200);pageIds.push(adminPage.data.data.id);const adminOnly=await invoke(admin,'manage-media',{id:crypto.randomUUID(),action:'usage'});assert.equal(adminOnly.status,404);
  console.log('Security integration: anon/inactive denied, editor scoped, admin allowed, signup disabled.');
}finally{
  if(pageIds.length)await service.from('pages').delete().in('id',pageIds);if(newsIds.length)await service.from('news_posts').delete().in('id',newsIds);if(userIds.length)await service.from('admin_profiles').delete().in('user_id',userIds);for(const id of userIds)await service.auth.admin.deleteUser(id);
}
