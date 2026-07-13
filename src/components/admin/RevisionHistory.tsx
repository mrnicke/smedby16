import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revisionChanges } from '../../lib/cms/revisions';
import { diffEditorDocuments } from '../../lib/cms/revisionsV2';
import { editorDocumentV2Schema, migrateLegacyBlocks, type ContentBlock, type EditorDocumentV2 } from '../../lib/cms/schema';
import { AdminLoading, AdminNotice, type NoticeTone } from './AdminFeedback';

type Revision = { id: string; entity_type: string; entity_id: string; revision_no: number; snapshot: Record<string, unknown>; created_at: string; restored_from_id: string | null };
type UiChange={key:string;label:string;before?:unknown;after?:unknown;structural?:boolean};
const fieldLabels:Record<string,string>={title:'Titel',slug:'Adress',seo_title:'SEO-titel',seo_description:'Metabeskrivning',is_published:'Publiceringsstatus',template:'Sidmall',summary:'Sammanfattning',published_at:'Publiceringsdatum',original_name:'Filnamn',alt_text:'Alternativtext',footer_text:'Sidfotstext'};
const ignoredFields=new Set(['editor_document','blocks','body_blocks','created_at','updated_at','created_by','updated_by','published_version','editor_version']);
function display(value:unknown){if(value===undefined||value===null||value==='')return 'Saknas';if(typeof value==='boolean')return value?'Ja':'Nej';if(typeof value==='string')return value;return 'Innehåll uppdaterat';}
function documentFrom(snapshot:Record<string,unknown>|null):EditorDocumentV2|null{if(!snapshot)return null;const parsed=editorDocumentV2Schema.safeParse(snapshot.editor_document);if(parsed.success)return parsed.data;const legacy=Array.isArray(snapshot.blocks)?snapshot.blocks:Array.isArray(snapshot.body_blocks)?snapshot.body_blocks:null;if(!legacy)return null;try{return migrateLegacyBlocks(legacy as ContentBlock[],String(snapshot.id??'revision'));}catch{return null;}}
function describeChanges(previous:Record<string,unknown>|null,current:Record<string,unknown>):UiChange[]{const before=documentFrom(previous),after=documentFrom(current);const structural=before&&after?diffEditorDocuments(before,after).map((change,index)=>({key:`editor-${index}-${change.nodeId??''}`,label:change.label,structural:true})):[];const fields=revisionChanges(previous,current).filter(change=>!ignoredFields.has(change.field)).map(change=>({key:`field-${change.field}`,label:fieldLabels[change.field]??'Inställning ändrad',before:change.before,after:change.after}));return [...structural,...fields];}
function revisionLabel(item: Revision) { return String(item.snapshot.title ?? item.snapshot.original_name ?? item.entity_type); }
const typeLabels: Record<string, string> = { pages: 'Sidor', news_posts: 'Nyheter', calendar_events: 'Kalender', documents: 'Dokument', media_assets: 'Media', navigation_items: 'Navigation', site_settings: 'Inställningar', editor_templates:'Sidmallar', reusable_components:'Synkade komponenter', global_layouts:'Globala delar' };

export default function RevisionHistory({ client }: { client: SupabaseClient }) {
  const [items, setItems] = useState<Revision[]>([]);
  const [selected, setSelected] = useState<Revision | null>(null);
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [tone, setTone] = useState<NoticeTone>('info');
  const load = async () => { const { data, error } = await client.from('content_revisions').select('*').order('created_at', { ascending: false }).limit(200); if (error) { setTone('error'); setMessage('Versionshistoriken kunde inte hämtas. Försök igen.'); } else setItems(data ?? []); setLoading(false); };
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => filter === 'all' ? items : items.filter((item) => item.entity_type === filter), [items, filter]);
  const previous = selected ? items.find((item) => item.entity_type === selected.entity_type && item.entity_id === selected.entity_id && item.revision_no === selected.revision_no - 1) ?? null : null;
  const changes = selected ? describeChanges(previous?.snapshot ?? null, selected.snapshot) : [];
  const restore = async () => {
    if (!selected || !confirm(`Återställa revision ${selected.revision_no} som aktuell version?`)) return;
    const { data, error } = await client.functions.invoke('restore-revision', { body: { revisionId: selected.id } });
    setTone(error ? 'error' : 'success'); setMessage(error ? data?.error ?? 'Versionen kunde inte återställas.' : 'Klart! Versionen är återställd som en ny aktuell version.');
    if (!error) await load();
  };
  if (loading) return <AdminLoading label="Hämtar versionshistoriken" />;
  return <section className="admin-panel revision-panel"><div className="admin-page-header"><div><p className="eyebrow">Trygg återställning</p><h1>Versionshistorik</h1><p>Jämför tidigare ändringar och återställ utan att historiken försvinner.</p></div><label>Visa innehållstyp<select value={filter} onChange={(event) => { setFilter(event.target.value); setSelected(null); }}><option value="all">Alla typer</option>{Object.entries(typeLabels).map(([type, label]) => <option value={type} key={type}>{label}</option>)}</select></label></div>
    <AdminNotice message={message} tone={tone} onDismiss={() => setMessage('')} />
    <div className="revision-layout"><div className="revision-list">{filtered.map((item) => <button type="button" className={selected?.id === item.id ? 'is-selected' : ''} key={item.id} onClick={() => setSelected(item)}><strong>{revisionLabel(item)}</strong><span>{item.entity_type} · revision {item.revision_no}</span><small>{new Date(item.created_at).toLocaleString('sv-SE')}{item.restored_from_id ? ' · återställning' : ''}</small></button>)}</div>
      {selected ? <aside className="revision-diff"><div className="admin-heading"><div><p className="eyebrow">Revision {selected.revision_no}</p><h2>Vad ändrades?</h2><p>Jämfört med föregående version av samma post.</p></div><button type="button" className="button button-primary" onClick={restore}><i className="ph ph-clock-counter-clockwise" aria-hidden="true" />Återställ denna version</button></div>{changes.length ? <ol className="revision-change-list">{changes.map(change=><li key={change.key}><i className={`ph ${change.structural?'ph-arrows-clockwise':'ph-pencil-simple'}`} aria-hidden="true"/><div><strong>{change.label}</strong>{!change.structural&&<span><s>{display(change.before)}</s><i className="ph ph-arrow-right" aria-hidden="true"/>{display(change.after)}</span>}</div></li>)}</ol> : <div className="empty-state"><i className="ph ph-file-dashed" aria-hidden="true" /><p>Detta är den första versionen eller så saknas jämförbara ändringar.</p></div>}</aside> : <div className="empty-state revision-empty"><i className="ph ph-cursor-click" aria-hidden="true" /><p>Välj en version för att se vad som ändrades.</p></div>}
    </div>
  </section>;
}
