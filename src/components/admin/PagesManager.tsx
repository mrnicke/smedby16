import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cmsPageSchema, validatePageBlocks, type CmsPage } from '../../lib/cms/schema';
import { invalidInternalHrefs } from '../../lib/cms/links';
import BlockEditor, { type EditorMediaAsset } from './BlockEditor';
import { confirmDiscard, useUnsavedChanges } from './useUnsavedChanges';

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
  const dirty = Boolean(selected && baseline && JSON.stringify(selected) !== baseline);
  useUnsavedChanges(dirty);

  const load = async (keepId?: string) => {
    const [{ data: pageRows, error }, { data: mediaRows }, { data: userData }] = await Promise.all([
      client.from('pages').select('*').order('title'),
      client.from('media_assets').select('id,original_name,mime_type,storage_path,alt_text').is('deleted_at', null).like('mime_type', 'image/%').order('original_name'),
      client.auth.getUser(),
    ]);
    if (error) { setMessage('Sidorna kunde inte hämtas.'); return; }
    const parsed = (pageRows ?? []).map((row) => ({ ...cmsPageSchema.parse(row), updated_by: row.updated_by as string | null | undefined }));
    setPages(parsed); setUserId(userData.user?.id ?? '');
    setMedia((mediaRows ?? []).map((item) => ({ ...item, public_url: client.storage.from('public-media').getPublicUrl(item.storage_path).data.publicUrl })));
    if (keepId) {
      const next = parsed.find((page) => page.id === keepId) ?? null;
      setSelected(next); setBaseline(next ? JSON.stringify(next) : '');
    }
  };
  useEffect(() => { void load(); }, []);
  const pagePaths = useMemo(() => pages.map((page) => page.slug), [pages]);
  const choose = (page: PageRow) => { if (!confirmDiscard(dirty)) return; setSelected(page); setBaseline(JSON.stringify(page)); setMessage(''); };
  const save = async () => {
    if (!selected || saving) return;
    setSaving(true); setMessage('Kontrollerar länkar och publicerar…');
    try {
      validatePageBlocks(selected.template, selected.blocks);
      const invalid = invalidInternalHrefs(selected.blocks, pagePaths);
      if (invalid.length) throw new Error(`Rätta okända interna länkar: ${invalid.join(', ')}`);
      const savedRow = await savePage(client, selected);
      const saved = { ...cmsPageSchema.parse(savedRow), updated_by: savedRow.updated_by };
      setSelected(saved); setBaseline(JSON.stringify(saved)); setMessage(saved.is_published ? 'Sidan är publicerad live.' : 'Sidan är sparad men inte publicerad.');
      await load(saved.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Sidan kunde inte sparas.'); }
    finally { setSaving(false); }
  };
  return <div className="admin-split pages-manager"><aside><h2>Sidor</h2>{pages.map((page) => <button type="button" className={selected?.id === page.id ? 'is-active' : ''} key={page.id} onClick={() => choose(page)}><span>{page.title}</span><small>{page.is_published ? 'Publicerad' : 'Inte publicerad'}</small></button>)}</aside><section>
    {selected ? <><div className="admin-heading"><div><p className="eyebrow">{selected.slug}</p><h1>{selected.title}</h1><small>Senast ändrad {new Date(selected.updated_at).toLocaleString('sv-SE')}{selected.updated_by === userId ? ' av dig' : ''}</small></div><div className="admin-actions">{dirty && <span className="dirty-badge">Osparade ändringar</span>}<button className="button button-primary" disabled={saving || !dirty} onClick={save}>{saving ? 'Sparar…' : 'Spara och publicera'}</button></div></div>
      <div className="editor-section"><h2>Sidinformation och SEO</h2><div className="field-grid"><label>Titel<input value={selected.title} maxLength={160} onChange={(event) => setSelected({ ...selected, title: event.target.value })} /></label><label>SEO-titel<input value={selected.seo_title ?? ''} maxLength={200} onChange={(event) => setSelected({ ...selected, seo_title: event.target.value || null })} /></label><label className="span-two">SEO-beskrivning<textarea value={selected.seo_description ?? ''} maxLength={320} onChange={(event) => setSelected({ ...selected, seo_description: event.target.value || null })} /></label><label>Delningsbild<select value={selected.social_media_id ?? ''} onChange={(event) => setSelected({ ...selected, social_media_id: event.target.value || null })}><option value="">Webbplatsens standardbild</option>{media.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}</select></label><label className="check"><input type="checkbox" checked={selected.is_published} onChange={(event) => setSelected({ ...selected, is_published: event.target.checked })} /> Publicerad</label></div>
        <div className="seo-preview"><span>Förhandsvisning i sökresultat</span><strong>{selected.seo_title || `${selected.title} | Smedby 1:6`}</strong><small>www.smedby1-6.se{selected.slug}</small><p>{selected.seo_description || 'Lägg till en tydlig beskrivning av sidan.'}</p></div></div>
      <BlockEditor template={selected.template} blocks={selected.blocks} media={media} onChange={(blocks) => setSelected({ ...selected, blocks })} />
      {message && <p role="status" className="save-message">{message}</p>}
    </> : <div className="empty-panel"><h1>Välj en sida</h1><p>Sidornas adresser är fasta, men allt innehåll, SEO och bilder kan redigeras.</p></div>}
  </section></div>;
}
