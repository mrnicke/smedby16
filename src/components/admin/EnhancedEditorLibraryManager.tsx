import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { migrateLegacyBlocks, type CmsPage, type ContentBlock, type EditorDocumentV2 } from '../../lib/cms/schema';
import { AdminNotice } from './AdminFeedback';
import VisualEditor from './VisualEditor';

type Item = { id:string; name?:string; layout_type?:string; description?:string; version?:number; is_published?:boolean; editor_document?:EditorDocumentV2 };
const layoutLabels:Record<string,string>={header:'Sidhuvud',navigation:'Navigation',footer:'Sidfot'};
const allowedByLayout:Record<string,ContentBlock['type'][]>= {
  header:['image','heading','link_list','button','divider','spacer'],
  navigation:['link_list','button','image','divider','spacer'],
  footer:['rich_text','heading','link_list','image','button','divider','spacer'],
};

export default function EnhancedEditorLibraryManager({client,role}:{client:SupabaseClient;role:'editor'|'admin'}) {
  const [templates,setTemplates]=useState<Item[]>([]);
  const [components,setComponents]=useState<Item[]>([]);
  const [layouts,setLayouts]=useState<Item[]>([]);
  const [editingLayout,setEditingLayout]=useState<Item|null>(null);
  const [message,setMessage]=useState('');
  const load=async()=>{const [a,b,c]=await Promise.all([client.from('editor_templates').select('*').order('name'),client.from('reusable_components').select('*').order('name'),client.from('global_layouts').select('*').order('layout_type')]);setTemplates(a.data??[]);setComponents(b.data??[]);setLayouts(c.data??[]);};
  useEffect(()=>{void load();},[]);
  const invoke=async(body:Record<string,unknown>)=>{const {data,error}=await client.functions.invoke('editor-library',{body});if(error)throw new Error(data?.error??error.message);return data.data;};
  const createTemplate=async()=>{const name=window.prompt('Mallens namn');if(!name)return;try{await invoke({resource:'template',action:'create',payload:{name,description:'',template_type:'page',editor_document:migrateLegacyBlocks([{type:'hero',heading:'Ny sida',text:''}],`template-${name}`),locked_node_ids:[],editable_fields:{}}});setMessage('Mallen är skapad.');await load();}catch(error){setMessage(error instanceof Error?error.message:'Mallen kunde inte skapas.');}};
  const createLayout=async()=>{const layoutType=window.prompt('Välj header, navigation eller footer.');if(!layoutType||!['header','navigation','footer'].includes(layoutType))return;try{await invoke({resource:'global_layout',action:'create',payload:{layout_type:layoutType,editor_document:migrateLegacyBlocks([{type:'link_list',heading:layoutLabels[layoutType],links:[{label:'Start',href:'/'}]}],`layout-${layoutType}`)}});setMessage('Den globala delen är skapad.');await load();}catch(error){setMessage(error instanceof Error?error.message:'Den globala delen kunde inte skapas.');}};

  if(role!=='admin') return <section className="admin-panel"><h1>Editorbibliotek</h1><p>Du kan använda publicerade mallar och komponenter i editorn. Endast administratörer kan ändra biblioteket.</p></section>;
  if(editingLayout){const type=editingLayout.layout_type??'header';const page={id:editingLayout.id,page_key:`global-${type}`,slug:'/',template:'standard',title:layoutLabels[type]??type,blocks:[],editor_version:2,editor_document:editingLayout.editor_document,is_published:Boolean(editingLayout.is_published),published_version:editingLayout.version??1,version:editingLayout.version??1} as unknown as CmsPage;return <VisualEditor client={client} entityType="global_layout" page={page} allowedBlockTypes={allowedByLayout[type]} onExit={()=>setEditingLayout(null)} onPublished={(saved)=>{setEditingLayout(current=>current?{...current,...saved}:null);void load();}}/>;}
  return <section className="admin-panel editor-library"><div className="admin-heading"><div><p className="eyebrow">Visuell editor</p><h1>Mallar och globala delar</h1></div></div><AdminNotice message={message} tone="info" onDismiss={()=>setMessage('')}/><section><div className="section-heading"><h2>Sidmallar</h2><button className="button button-primary" onClick={createTemplate}>Skapa tom mall</button></div>{templates.map(item=><article key={item.id}><div><strong>{item.name}</strong><small>{item.description||'Ingen beskrivning'}</small></div><button onClick={()=>void (async()=>{await invoke({resource:'template',action:'archive',id:item.id});await load();})()}>Arkivera</button></article>)}</section><section><div className="section-heading"><h2>Synkade komponenter</h2></div>{components.length?components.map(item=><article key={item.id}><div><strong>{item.name}</strong><small>Version {item.version} · {item.is_published?'Publicerad':'Utkast'}</small></div><button onClick={()=>void (async()=>{try{const usage=await invoke({resource:'component',action:'usage',id:item.id});setMessage(usage.length?`Används på ${usage.length} platser.`:'Komponenten används inte.');}catch(error){setMessage(error instanceof Error?error.message:'Användningen kunde inte hämtas.');}})()}>Visa användning</button></article>):<p>Skapa en synkad komponent från en markerad sektion i editorn.</p>}</section><section><div className="section-heading"><h2>Header, navigation och footer</h2><button onClick={createLayout}>Skapa global del</button></div>{layouts.map(item=><article key={item.id}><div><strong>{layoutLabels[item.layout_type??'']??item.layout_type}</strong><small>{item.is_published?'Publicerad':'Utkast'} · version {item.version??1}</small></div><button type="button" onClick={()=>setEditingLayout(item)}>Öppna visuell editor</button></article>)}</section></section>;
}
