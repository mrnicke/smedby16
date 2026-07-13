import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cmsPageSchema, validatePageBlocks, type CmsPage } from '../../lib/cms/schema';
import { invalidInternalHrefs } from '../../lib/cms/links';
import BlockEditor, { type EditorMediaAsset } from './BlockEditor';
const VisualEditor=lazy(()=>import('./VisualEditor'));
import { confirmDiscard, useUnsavedChanges } from './useUnsavedChanges';
import { AdminLoading, AdminNotice, CharacterCount, type NoticeTone } from './AdminFeedback';
import { useSaveShortcut } from './useAdminShortcuts';

type PageRow = CmsPage & { updated_by?: string | null };
type MediaRow = EditorMediaAsset & { mime_type: string };
type TemplateRow = { id:string; name:string; description:string };

const pageGuidance: Record<string, { description: string; icon: string }> = {
  '/': { description: 'Det första besökaren ser på webbplatsen.', icon: 'ph-house' },
  '/for-boende/': { description: 'Praktisk information för boende i området.', icon: 'ph-users-three' },
  '/kontakt/': { description: 'Kontaktuppgifter och vägar till styrelsen.', icon: 'ph-envelope-simple' },
  '/kalender/': { description: 'Introduktionen och informationen på kalendersidan.', icon: 'ph-calendar-dots' },
  '/nyheter/': { description: 'Introduktionen och informationen på nyhetssidan.', icon: 'ph-newspaper' },
  '/dokument/': { description: 'Introduktionen och informationen på dokumentsidan.', icon: 'ph-files' },
  '/medlemmar/': { description: 'Information som riktar sig till föreningens medlemmar.', icon: 'ph-identification-card' },
  '/stadgar/': { description: 'Föreningens stadgar och relaterad information.', icon: 'ph-scroll' },
  '/trafikregler/': { description: 'Regler och information om trafik i området.', icon: 'ph-car' },
  '/sok/': { description: 'Hjälptexten på webbplatsens söksida.', icon: 'ph-magnifying-glass' },
};

function guidanceFor(page: PageRow) {
  return pageGuidance[page.slug] ?? { description: 'Text, bilder och information på den här sidan.', icon: 'ph-file-text' };
}

async function savePage(client: SupabaseClient, payload: PageRow) {
  const { data, error } = await client.functions.invoke('save-content', { body: { entity: 'pages', payload } });
  if (error) throw new Error(data?.error ?? error.message);
  return data.data as PageRow;
}

export default function PagesManager({ client }: { client: SupabaseClient }) {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [selected, setSelected] = useState<PageRow | null>(null);
  const [baseline, setBaseline] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [tone, setTone] = useState<NoticeTone>('info');
  const [templates,setTemplates]=useState<TemplateRow[]>([]);
  const dirty = Boolean(selected && baseline && JSON.stringify(selected) !== baseline);
  useUnsavedChanges(dirty);

  const load = async (keepId?: string) => {
    const [{ data: pageRows, error }, { data: mediaRows }, { data: userData }, {data:templateRows}] = await Promise.all([
      client.from('pages').select('*').order('title'),
      client.from('media_assets').select('id,original_name,mime_type,storage_path,alt_text').is('deleted_at', null).like('mime_type', 'image/%').order('original_name'),
      client.auth.getUser(),
      client.from('editor_templates').select('id,name,description').eq('active',true).is('archived_at',null).order('name'),
    ]);
    if (error) { setTone('error'); setMessage('Sidorna kunde inte hämtas. Försök igen.'); setLoading(false); return; }
    const parsed = (pageRows ?? []).map((row) => ({ ...cmsPageSchema.parse(row), updated_by: row.updated_by as string | null | undefined }));
    setPages(parsed); setUserId(userData.user?.id ?? ''); setTemplates(templateRows??[]);
    setMedia((mediaRows ?? []).map((item) => ({ ...item, public_url: client.storage.from('public-media').getPublicUrl(item.storage_path).data.publicUrl })));
    if (keepId) {
      const next = parsed.find((page) => page.id === keepId) ?? null;
      setSelected(next); setBaseline(next ? JSON.stringify(next) : '');
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const pagePaths = useMemo(() => pages.map((page) => page.slug), [pages]);
  const filteredPages = useMemo(() => pages
    .filter((page) => page.title.toLocaleLowerCase('sv-SE').includes(query.toLocaleLowerCase('sv-SE')))
    .sort((a, b) => a.slug === '/' ? -1 : b.slug === '/' ? 1 : a.title.localeCompare(b.title, 'sv-SE')), [pages, query]);
  const choose = (page: PageRow) => { if (!confirmDiscard(dirty)) return; setSelected(page); setBaseline(JSON.stringify(page)); setMessage(''); };
  const showPagePicker = () => { if (!confirmDiscard(dirty)) return; setSelected(null); setBaseline(''); setMessage(''); setQuery(''); };
  const save = async () => {
    if (!selected || saving) return;
    setSaving(true); setTone('info'); setMessage('Kontrollerar länkar och sparar…');
    try {
      validatePageBlocks(selected.template, selected.blocks);
      const invalid = invalidInternalHrefs(selected.blocks, pagePaths);
      if (invalid.length) throw new Error(`Rätta okända interna länkar: ${invalid.join(', ')}`);
      const savedRow = await savePage(client, selected);
      const saved = { ...cmsPageSchema.parse(savedRow), updated_by: savedRow.updated_by };
      setSelected(saved); setBaseline(JSON.stringify(saved)); setTone('success'); setMessage(saved.is_published ? 'Klart – sidan är uppdaterad och syns direkt.' : 'Klart – sidan är sparad utan att vara publicerad.');
      await load(saved.id);
    } catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'Sidan kunde inte sparas.'); }
    finally { setSaving(false); }
  };
  useSaveShortcut(dirty && !saving, save);
  const createVisualPage=async(templateId?:string)=>{const title=window.prompt('Vad ska sidan heta?');if(!title?.trim())return;const suggested=`/${title.toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}/`;const slug=window.prompt('Ange sidans adress.',suggested);if(!slug)return;try{const {data,error}=await client.functions.invoke('editor-content',{body:{action:'create_page',entityType:'page',title:title.trim(),slug,templateId}});if(error)throw new Error(data?.error??error.message);await load(data.data.id);setSelected({...cmsPageSchema.parse(data.data),updated_by:data.data.updated_by});}catch(error){setTone('error');setMessage(error instanceof Error?error.message:'Sidan kunde inte skapas.');}};
  if (loading) return <AdminLoading label="Hämtar sidor" />;

  if (!selected) return <section className="page-picker admin-panel" aria-labelledby="page-picker-title">
    <div className="page-picker-header"><div><p className="eyebrow">Redigera sidor</p><h1 id="page-picker-title">Vilken sida vill du ändra?</h1><p>Välj sidan som motsvarar informationen du vill uppdatera.</p></div><span className="page-count"><strong>{pages.length}</strong> sidor</span></div>
    {import.meta.env.PUBLIC_ADVANCED_EDITOR==='true'&&<div className="admin-actions"><button type="button" className="button button-primary" onClick={()=>createVisualPage()}>Skapa tom sida</button><button type="button" className="button button-secondary" disabled={!templates.length} onClick={()=>{const choice=window.prompt(`Välj mall:\n${templates.map((item,index)=>`${index+1}. ${item.name}`).join('\n')}`);const template=templates[Number(choice)-1];if(template)void createVisualPage(template.id);}}>Skapa från mall</button></div>}
    <label className="page-picker-search"><span className="sr-only">Sök efter en sida</span><i className="ph ph-magnifying-glass" aria-hidden="true" /><input type="search" placeholder="Sök efter en sida…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="page-picker-grid">{filteredPages.map((page) => {
      const guidance = guidanceFor(page);
      return <button type="button" className="page-picker-card" key={page.id} onClick={() => choose(page)} aria-label={`Redigera ${page.title}`}><span className="page-picker-icon"><i className={`ph ${guidance.icon}`} aria-hidden="true" /></span><span className="page-picker-copy"><strong>{page.title}</strong><span>{guidance.description}</span><small><span className={page.is_published ? 'status-dot is-published' : 'status-dot'} />{page.is_published ? 'Publicerad' : 'Inte publicerad'}</small></span><span className="page-picker-action">Redigera <i className="ph ph-arrow-right" aria-hidden="true" /></span></button>;
    })}</div>
    {filteredPages.length === 0 && <div className="empty-state"><i className="ph ph-magnifying-glass" aria-hidden="true" /><strong>Ingen sida hittades</strong><p>Prova ett annat sökord.</p></div>}
  </section>;

  if (import.meta.env.PUBLIC_ADVANCED_EDITOR === 'true') return <Suspense fallback={<AdminLoading label="Öppnar den visuella editorn"/>}><VisualEditor client={client} page={selected} onExit={showPagePicker} onPublished={(saved) => { setSelected(saved); setPages((current) => current.map((page) => page.id === saved.id ? { ...page, ...saved } : page)); }} /></Suspense>;

  return <section className="page-editor admin-panel">
    <button className="page-editor-back" type="button" onClick={showPagePicker}><i className="ph ph-arrow-left" aria-hidden="true" />Alla sidor</button>
    <div className="admin-heading page-editor-heading"><div><p className="eyebrow">{selected.slug === '/' ? 'Startsida' : selected.slug}</p><h1>{selected.title}</h1><p>Ändra text, bilder och länkar nedan. Förhandsvisningen visar hur sidan kommer att se ut.</p><small>Senast ändrad {new Date(selected.updated_at).toLocaleString('sv-SE')}{selected.updated_by === userId ? ' av dig' : ''}</small></div><span className={selected.is_published ? 'page-publication-state is-published' : 'page-publication-state'}><span className={selected.is_published ? 'status-dot is-published' : 'status-dot'} />{selected.is_published ? 'Synlig på webbplatsen' : 'Inte publicerad'}</span></div>
    <AdminNotice message={message} tone={tone} onDismiss={() => setMessage('')} />
    <BlockEditor client={client} template={selected.template} blocks={selected.blocks} media={media} onMediaUploaded={(asset) => setMedia((current) => [asset, ...current])} onChange={(blocks) => setSelected({ ...selected, blocks })} />
    <details className="advanced-settings"><summary><span className="advanced-settings-icon"><i className="ph ph-sliders-horizontal" aria-hidden="true" /></span><span><strong>Sidans inställningar</strong><small>Sidnamn, publicering och information för sökmotorer</small></span><i className="ph ph-caret-down" aria-hidden="true" /></summary><div className="editor-section advanced-settings-body"><div className="section-heading"><div><h2>Sidnamn och sökresultat</h2><p>Dessa inställningar behöver vanligtvis inte ändras.</p></div></div><div className="field-grid"><label>Sidans namn<input value={selected.title} maxLength={160} onChange={(event) => setSelected({ ...selected, title: event.target.value })} /><CharacterCount value={selected.title} max={160} /></label><label>Rubrik i sökresultat<input value={selected.seo_title ?? ''} maxLength={200} onChange={(event) => setSelected({ ...selected, seo_title: event.target.value || null })} /><CharacterCount value={selected.seo_title ?? ''} max={200} /></label><label className="span-two">Beskrivning i sökresultat<textarea value={selected.seo_description ?? ''} maxLength={320} onChange={(event) => setSelected({ ...selected, seo_description: event.target.value || null })} /><CharacterCount value={selected.seo_description ?? ''} max={320} /></label><label>Bild vid delning<select value={selected.social_media_id ?? ''} onChange={(event) => setSelected({ ...selected, social_media_id: event.target.value || null })}><option value="">Webbplatsens standardbild</option>{media.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}</select></label><label className="check publish-toggle"><input type="checkbox" checked={selected.is_published} onChange={(event) => setSelected({ ...selected, is_published: event.target.checked })} /><span><strong>Visa sidan på webbplatsen</strong><small>Avmarkera för att dölja sidan för besökare.</small></span></label></div>
      <div className="seo-preview"><span>Så kan sidan visas i Google</span><strong>{selected.seo_title || `${selected.title} | Smedby 1:6`}</strong><small>www.smedby1-6.se{selected.slug}</small><p>{selected.seo_description || 'Lägg till en tydlig beskrivning av sidan.'}</p></div></div></details>
    <div className={`editor-save-bar ${dirty ? 'has-changes' : ''}`} role="region" aria-label="Spara ändringar"><div>{saving ? <i className="ph ph-spinner-gap" aria-hidden="true" /> : dirty ? <i className="ph ph-pencil-simple" aria-hidden="true" /> : <i className="ph ph-check-circle" aria-hidden="true" />}<span><strong>{saving ? 'Sparar ändringarna…' : dirty ? 'Du har osparade ändringar' : 'Alla ändringar är sparade'}</strong><small>{dirty ? 'Spara när du är nöjd med sidan.' : 'Du kan tryggt lämna sidan.'}</small></span></div><button className="button button-primary" disabled={saving || !dirty} onClick={save} title="Spara ändringar (Ctrl+S)"><i className="ph ph-floppy-disk" aria-hidden="true" />{saving ? 'Sparar…' : 'Spara ändringar'}</button></div>
  </section>;
}
