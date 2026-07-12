import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cmsPageSchema, validatePageBlocks, type CmsPage } from '../../lib/cms/schema';
import { invalidInternalHrefs } from '../../lib/cms/links';
import BlockEditor, { type EditorMediaAsset } from './BlockEditor';
import { confirmDiscard, useUnsavedChanges } from './useUnsavedChanges';
import { AdminLoading, AdminNotice, CharacterCount, type NoticeTone } from './AdminFeedback';
import { useSaveShortcut } from './useAdminShortcuts';

type PageRow = CmsPage & { updated_by?: string | null };
type MediaRow = EditorMediaAsset & { mime_type: string };

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
  const dirty = Boolean(selected && baseline && JSON.stringify(selected) !== baseline);
  useUnsavedChanges(dirty);

  const load = async (keepId?: string) => {
    const [{ data: pageRows, error }, { data: mediaRows }, { data: userData }] = await Promise.all([
      client.from('pages').select('*').order('title'),
      client.from('media_assets').select('id,original_name,mime_type,storage_path,alt_text').is('deleted_at', null).like('mime_type', 'image/%').order('original_name'),
      client.auth.getUser(),
    ]);
    if (error) { setTone('error'); setMessage('Sidorna kunde inte hämtas. Försök igen.'); setLoading(false); return; }
    const parsed = (pageRows ?? []).map((row) => ({ ...cmsPageSchema.parse(row), updated_by: row.updated_by as string | null | undefined }));
    setPages(parsed); setUserId(userData.user?.id ?? '');
    setMedia((mediaRows ?? []).map((item) => ({ ...item, public_url: client.storage.from('public-media').getPublicUrl(item.storage_path).data.publicUrl })));
    if (keepId) {
      const next = parsed.find((page) => page.id === keepId) ?? null;
      setSelected(next); setBaseline(next ? JSON.stringify(next) : '');
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const pagePaths = useMemo(() => pages.map((page) => page.slug), [pages]);
  const filteredPages = useMemo(() => pages.filter((page) => page.title.toLocaleLowerCase('sv-SE').includes(query.toLocaleLowerCase('sv-SE'))), [pages, query]);
  const choose = (page: PageRow) => { if (!confirmDiscard(dirty)) return; setSelected(page); setBaseline(JSON.stringify(page)); setMessage(''); };
  const save = async () => {
    if (!selected || saving) return;
    setSaving(true); setTone('info'); setMessage('Kontrollerar länkar och sparar…');
    try {
      validatePageBlocks(selected.template, selected.blocks);
      const invalid = invalidInternalHrefs(selected.blocks, pagePaths);
      if (invalid.length) throw new Error(`Rätta okända interna länkar: ${invalid.join(', ')}`);
      const savedRow = await savePage(client, selected);
      const saved = { ...cmsPageSchema.parse(savedRow), updated_by: savedRow.updated_by };
      setSelected(saved); setBaseline(JSON.stringify(saved)); setTone('success'); setMessage(saved.is_published ? 'Klart! Sidan är publicerad och syns direkt.' : 'Sidan är sparad utan att vara publicerad.');
      await load(saved.id);
    } catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'Sidan kunde inte sparas.'); }
    finally { setSaving(false); }
  };
  useSaveShortcut(dirty && !saving, save);
  if (loading) return <AdminLoading label="Hämtar sidor" />;
  return <div className="admin-split pages-manager"><aside className="content-sidebar"><div className="content-sidebar-heading"><div><p className="eyebrow">Innehåll</p><h2>Sidor</h2></div><span>{pages.length}</span></div><label className="sidebar-search"><span className="sr-only">Sök sida</span><i className="ph ph-magnifying-glass" aria-hidden="true" /><input type="search" placeholder="Sök sida…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="content-sidebar-list">{filteredPages.map((page) => <button type="button" className={selected?.id === page.id ? 'is-active' : ''} key={page.id} onClick={() => choose(page)}><span>{page.title}</span><small><span className={page.is_published ? 'status-dot is-published' : 'status-dot'} />{page.is_published ? 'Publicerad' : 'Inte publicerad'}</small></button>)}{filteredPages.length === 0 && <p className="empty-note">Ingen sida matchar sökningen.</p>}</div></aside><section>
    {selected ? <><div className="admin-heading editor-toolbar"><div><p className="eyebrow">{selected.slug === '/' ? 'Startsida' : selected.slug}</p><h1>{selected.title}</h1><small>Senast ändrad {new Date(selected.updated_at).toLocaleString('sv-SE')}{selected.updated_by === userId ? ' av dig' : ''}</small></div><div className="admin-actions">{dirty && <span className="dirty-badge"><i className="ph ph-pencil-simple" aria-hidden="true" />Osparat</span>}<button className="button button-primary" disabled={saving || !dirty} onClick={save} title="Spara (Ctrl+S)"><i className="ph ph-floppy-disk" aria-hidden="true" />{saving ? 'Sparar…' : 'Spara'}</button></div></div><AdminNotice message={message} tone={tone} onDismiss={() => setMessage('')} />
      <div className="editor-section"><div className="section-heading"><div><h2>Sidinformation och SEO</h2><p>Detta styr sidans namn och hur den visas i sökresultat.</p></div></div><div className="field-grid"><label>Titel<input value={selected.title} maxLength={160} onChange={(event) => setSelected({ ...selected, title: event.target.value })} /><CharacterCount value={selected.title} max={160} /></label><label>SEO-titel<input value={selected.seo_title ?? ''} maxLength={200} onChange={(event) => setSelected({ ...selected, seo_title: event.target.value || null })} /><CharacterCount value={selected.seo_title ?? ''} max={200} /></label><label className="span-two">SEO-beskrivning<textarea value={selected.seo_description ?? ''} maxLength={320} onChange={(event) => setSelected({ ...selected, seo_description: event.target.value || null })} /><CharacterCount value={selected.seo_description ?? ''} max={320} /></label><label>Delningsbild<select value={selected.social_media_id ?? ''} onChange={(event) => setSelected({ ...selected, social_media_id: event.target.value || null })}><option value="">Webbplatsens standardbild</option>{media.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}</select></label><label className="check publish-toggle"><input type="checkbox" checked={selected.is_published} onChange={(event) => setSelected({ ...selected, is_published: event.target.checked })} /><span><strong>Publicerad</strong><small>Sidan är synlig för besökare.</small></span></label></div>
        <div className="seo-preview"><span>Förhandsvisning i sökresultat</span><strong>{selected.seo_title || `${selected.title} | Smedby 1:6`}</strong><small>www.smedby1-6.se{selected.slug}</small><p>{selected.seo_description || 'Lägg till en tydlig beskrivning av sidan.'}</p></div></div>
      <BlockEditor template={selected.template} blocks={selected.blocks} media={media} onChange={(blocks) => setSelected({ ...selected, blocks })} />
    </> : <div className="empty-panel"><h1>Välj en sida</h1><p>Sidornas adresser är fasta, men allt innehåll, SEO och bilder kan redigeras.</p></div>}
  </section></div>;
}
