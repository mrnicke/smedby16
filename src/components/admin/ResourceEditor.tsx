import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { blockListSchema } from '../../lib/cms/schema';
import BlockEditor from './BlockEditor';
import { createResourceDraft, type CmsResourceKind } from '../../lib/cms/resources';

type ResourceKind = CmsResourceKind;
type Resource = Record<string, any>;
type MediaAsset = { id: string; original_name: string; mime_type: string; storage_path: string };

const labels: Record<ResourceKind, { singular: string; plural: string }> = {
  news_posts: { singular: 'nyhet', plural: 'Nyheter' },
  calendar_events: { singular: 'aktivitet', plural: 'Kalender' },
  documents: { singular: 'dokument', plural: 'Dokument' },
};

async function invokeSave(client: SupabaseClient, entity: ResourceKind, payload: Resource) {
  const { data, error } = await client.functions.invoke('save-content', { body: { entity, payload } });
  if (error) throw new Error(data?.error ?? error.message);
  return data.data as Resource;
}

function localDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export default function ResourceEditor({ client, kind }: { client: SupabaseClient; kind: ResourceKind }) {
  const [items, setItems] = useState<Resource[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async (keepId?: string) => {
    const [{ data, error }, { data: mediaRows }] = await Promise.all([
      client.from(kind).select('*').order('updated_at', { ascending: false }),
      client.from('media_assets').select('id,original_name,mime_type,storage_path').is('deleted_at', null).order('original_name'),
    ]);
    if (error) { setMessage('Innehållet kunde inte hämtas.'); return; }
    setItems(data ?? []);
    setMedia(mediaRows ?? []);
    if (keepId) setSelected((data ?? []).find((item) => item.id === keepId) ?? null);
  };

  useEffect(() => { setSelected(null); setMessage(''); void load(); }, [kind]);
  const pdfMedia = useMemo(() => media.filter((asset) => asset.mime_type === 'application/pdf'), [media]);

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true); setMessage('Kontrollerar och sparar…');
    try {
      if (kind === 'news_posts') blockListSchema.parse(selected.body_blocks);
      if (kind === 'documents' && !selected.media_id) throw new Error('Välj en uppladdad PDF innan dokumentet sparas.');
      if (kind === 'calendar_events' && selected.ends_at && new Date(selected.ends_at) < new Date(selected.starts_at)) throw new Error('Sluttiden måste vara efter starttiden.');
      const saved = await invokeSave(client, kind, selected);
      setSelected(saved);
      setMessage(saved.is_published ? 'Sparat och publicerat live.' : 'Sparat utan publicering.');
      await load(saved.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Innehållet kunde inte sparas.');
    } finally { setSaving(false); }
  };

  return <div className="admin-split resource-editor">
    <aside>
      <div className="resource-list-heading"><h2>{labels[kind].plural}</h2><button className="button button-primary" onClick={() => setSelected(createResourceDraft(kind))}>Skapa ny</button></div>
      {items.map((item) => <button className={selected?.id === item.id ? 'is-active' : ''} key={item.id} onClick={() => { setSelected(item); setMessage(''); }}><span>{item.title}</span><small>{item.is_published ? 'Publicerad' : 'Inte publicerad'}</small></button>)}
      {items.length === 0 && <p className="empty-note">Inga poster ännu.</p>}
    </aside>
    <section>
      {selected ? <>
        <div className="admin-heading"><div><p className="eyebrow">{selected.id ? `Redigera ${labels[kind].singular}` : `Skapa ${labels[kind].singular}`}</p><h1>{selected.title}</h1></div><button className="button button-primary" disabled={saving} onClick={save}>{saving ? 'Sparar…' : 'Spara'}</button></div>
        <div className="field-grid">
          <label>Titel<input value={selected.title} maxLength={160} onChange={(event) => setSelected({ ...selected, title: event.target.value })} /></label>
          {kind === 'news_posts' && <>
            <label>Slug<input value={selected.slug} pattern="[a-z0-9-]+" onChange={(event) => setSelected({ ...selected, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></label>
            <label className="span-two">Sammanfattning<textarea value={selected.summary} maxLength={600} onChange={(event) => setSelected({ ...selected, summary: event.target.value })} /></label>
            <label>Publiceringsdatum<input type="datetime-local" value={localDateTime(selected.published_at)} onChange={(event) => setSelected({ ...selected, published_at: isoDateTime(event.target.value) })} /></label>
            <label>Huvudbild (valfri)<select value={selected.hero_media_id ?? ''} onChange={(event) => setSelected({ ...selected, hero_media_id: event.target.value || null })}><option value="">Ingen bild</option>{media.filter((asset) => asset.mime_type.startsWith('image/')).map((asset) => <option value={asset.id} key={asset.id}>{asset.original_name}</option>)}</select></label>
          </>}
          {kind === 'calendar_events' && <>
            <label>Start<input type="datetime-local" value={localDateTime(selected.starts_at)} onChange={(event) => setSelected({ ...selected, starts_at: isoDateTime(event.target.value) })} /></label>
            <label>Slut (valfri)<input type="datetime-local" value={localDateTime(selected.ends_at)} onChange={(event) => setSelected({ ...selected, ends_at: isoDateTime(event.target.value) })} /></label>
            <label className="span-two">Beskrivning<textarea value={selected.description} maxLength={2500} onChange={(event) => setSelected({ ...selected, description: event.target.value })} /></label>
            <label>Plats<input value={selected.location ?? ''} onChange={(event) => setSelected({ ...selected, location: event.target.value || null })} /></label>
            <label>Kategori<select value={selected.category} onChange={(event) => setSelected({ ...selected, category: event.target.value })}>{['möte', 'aktivitet', 'underhåll', 'information'].map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
            <label className="span-two">Extern länk (valfri)<input type="url" placeholder="https://…" value={selected.external_url ?? ''} onChange={(event) => setSelected({ ...selected, external_url: event.target.value || null })} /></label>
            <label className="check"><input type="checkbox" checked={selected.all_day} onChange={(event) => setSelected({ ...selected, all_day: event.target.checked })} /> Heldag</label>
          </>}
          {kind === 'documents' && <>
            <label className="span-two">Beskrivning<textarea value={selected.description} maxLength={1000} onChange={(event) => setSelected({ ...selected, description: event.target.value })} /></label>
            <label>Dokumentdatum<input type="date" value={selected.document_date ?? ''} onChange={(event) => setSelected({ ...selected, document_date: event.target.value || null })} /></label>
            <label>Kategori<input value={selected.category} onChange={(event) => setSelected({ ...selected, category: event.target.value })} /></label>
            <label className="span-two">PDF<select value={selected.media_id} onChange={(event) => setSelected({ ...selected, media_id: event.target.value })}><option value="">Välj uppladdad PDF</option>{pdfMedia.map((asset) => <option value={asset.id} key={asset.id}>{asset.original_name}</option>)}</select>{pdfMedia.length === 0 && <small>Ladda först upp en PDF under Media.</small>}</label>
            <label>Sorteringsordning<input type="number" value={selected.sort_order} onChange={(event) => setSelected({ ...selected, sort_order: Number(event.target.value) })} /></label>
          </>}
          <label className="check"><input type="checkbox" checked={selected.is_published} onChange={(event) => setSelected({ ...selected, is_published: event.target.checked })} /> Publicerad</label>
        </div>
        {kind === 'news_posts' && <BlockEditor template="article" blocks={selected.body_blocks} onChange={(body_blocks) => setSelected({ ...selected, body_blocks })} />}
        {message && <p role="status" className="save-message">{message}</p>}
      </> : <div className="empty-panel"><h1>Välj eller skapa innehåll</h1><p>Alla ändringar valideras på servern innan de sparas.</p></div>}
    </section>
  </div>;
}
