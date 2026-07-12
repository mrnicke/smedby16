import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { blockListSchema } from '../../lib/cms/schema';
import BlockEditor from './BlockEditor';
import { createResourceDraft, type CmsResourceKind } from '../../lib/cms/resources';
import { confirmDiscard, useUnsavedChanges } from './useUnsavedChanges';
import { AdminLoading, AdminNotice, type NoticeTone } from './AdminFeedback';
import { useSaveShortcut } from './useAdminShortcuts';

type ResourceKind = CmsResourceKind;
type Resource = Record<string, any>;
type MediaAsset = { id: string; original_name: string; mime_type: string; storage_path: string; alt_text: string; public_url: string };

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

async function invokeManage(client: SupabaseClient, entity: ResourceKind, id: string, action: 'archive'|'restore'|'delete') {
  const { data, error } = await client.functions.invoke('manage-content', { body: { entity, id, action } });
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
  const [baseline, setBaseline] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [tone, setTone] = useState<NoticeTone>('info');
  const dirty = Boolean(selected && (!selected.id || (baseline && JSON.stringify(selected) !== baseline)));
  useUnsavedChanges(dirty);

  const load = async (keepId?: string) => {
    const [{ data, error }, { data: mediaRows }] = await Promise.all([
      client.from(kind).select('*').order('updated_at', { ascending: false }),
      client.from('media_assets').select('id,original_name,mime_type,storage_path,alt_text').is('deleted_at', null).order('original_name'),
    ]);
    if (error) { setTone('error'); setMessage('Innehållet kunde inte hämtas. Försök igen.'); setLoading(false); return; }
    setItems(data ?? []);
    setMedia((mediaRows ?? []).map((asset) => ({ ...asset, public_url: client.storage.from('public-media').getPublicUrl(asset.storage_path).data.publicUrl })));
    if (keepId) { const next = (data ?? []).find((item) => item.id === keepId) ?? null; setSelected(next); setBaseline(next ? JSON.stringify(next) : ''); }
    setLoading(false);
  };

  useEffect(() => { setSelected(null); setBaseline(''); setMessage(''); void load(); }, [kind]);
  const pdfMedia = useMemo(() => media.filter((asset) => asset.mime_type === 'application/pdf'), [media]);
  const filteredItems = useMemo(() => items.filter((item) => String(item.title).toLocaleLowerCase('sv-SE').includes(query.toLocaleLowerCase('sv-SE'))), [items, query]);

  const save = async () => {
    if (!selected || saving || selected.archived_at) return;
    setSaving(true); setTone('info'); setMessage('Kontrollerar och sparar…');
    try {
      if (kind === 'news_posts') blockListSchema.parse(selected.body_blocks);
      if (kind === 'documents' && !selected.media_id) throw new Error('Välj en uppladdad PDF innan dokumentet sparas.');
      if (kind === 'calendar_events' && selected.ends_at && new Date(selected.ends_at) < new Date(selected.starts_at)) throw new Error('Sluttiden måste vara efter starttiden.');
      const saved = await invokeSave(client, kind, selected);
      setSelected(saved); setBaseline(JSON.stringify(saved));
      setTone('success'); setMessage(saved.is_published ? 'Klart! Innehållet är publicerat och syns direkt.' : 'Innehållet är sparat utan att vara publicerat.');
      await load(saved.id);
    } catch (error) {
      setTone('error'); setMessage(error instanceof Error ? error.message : 'Innehållet kunde inte sparas.');
    } finally { setSaving(false); }
  };

  const manage = async (action: 'archive'|'restore'|'delete') => {
    if (!selected?.id || saving) return;
    if (action === 'archive' && !confirmDiscard(dirty)) return;
    const prompt = action === 'archive' ? `Arkivera ${selected.title}? Den försvinner från webbplatsen.` : action === 'restore' ? `Återställ ${selected.title} som opublicerad?` : `Ta bort ${selected.title} permanent? Versionshistoriken behålls, men posten kan inte återställas från adminpanelen.`;
    if (!confirm(prompt)) return;
    setSaving(true); setMessage(action === 'delete' ? 'Tar bort…' : 'Uppdaterar…');
    try {
      const result = await invokeManage(client, kind, selected.id, action);
      setTone('success'); if (action === 'delete') { setSelected(null); setMessage('Innehållet är permanent borttaget.'); await load(); }
      else { setSelected(result); setMessage(action === 'archive' ? 'Innehållet är arkiverat och syns inte längre publikt.' : 'Innehållet är återställt som opublicerat.'); await load(result.id); }
    } catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'Åtgärden kunde inte genomföras.'); }
    finally { setSaving(false); }
  };

  useSaveShortcut(dirty && !saving && !selected?.archived_at, save);
  if (loading) return <AdminLoading label={`Hämtar ${labels[kind].plural.toLocaleLowerCase('sv-SE')}`} />;
  return <div className="admin-split resource-editor">
    <aside className="content-sidebar">
      <div className="content-sidebar-heading"><div><p className="eyebrow">Innehåll</p><h2>{labels[kind].plural}</h2></div><span>{items.length}</span></div><button className="button button-primary create-button" onClick={() => { if (!confirmDiscard(dirty)) return; setSelected(createResourceDraft(kind)); setBaseline(''); setMessage(''); }}><i className="ph ph-plus" aria-hidden="true" />Skapa {labels[kind].singular}</button><label className="sidebar-search"><span className="sr-only">Sök {labels[kind].singular}</span><i className="ph ph-magnifying-glass" aria-hidden="true" /><input type="search" placeholder="Sök…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="content-sidebar-list">
      {filteredItems.map((item) => <button className={selected?.id === item.id ? 'is-active' : ''} key={item.id} onClick={() => { if (!confirmDiscard(dirty)) return; setSelected(item); setBaseline(JSON.stringify(item)); setMessage(''); }}><span>{item.title}</span><small><span className={`status-dot ${item.archived_at ? 'is-archived' : item.is_published ? 'is-published' : ''}`} />{item.archived_at ? 'Arkiverad' : item.is_published ? 'Publicerad' : 'Inte publicerad'}</small></button>)}
      {filteredItems.length === 0 && <p className="empty-note">{items.length ? 'Inget matchar sökningen.' : 'Inga poster ännu.'}</p>}</div>
    </aside>
    <section>
      {selected ? <>
        <div className="admin-heading editor-toolbar"><div><p className="eyebrow">{selected.archived_at ? 'Arkiverat innehåll' : selected.id ? `Redigera ${labels[kind].singular}` : `Ny ${labels[kind].singular}`}</p><h1>{selected.title}</h1></div><div className="admin-actions">{dirty && <span className="dirty-badge"><i className="ph ph-pencil-simple" aria-hidden="true" />Osparat</span>}{selected.id && !selected.archived_at && <button className="button button-secondary" disabled={saving} onClick={() => manage('archive')}><i className="ph ph-archive" aria-hidden="true" />Arkivera</button>}{selected.archived_at && <><button className="button button-secondary" disabled={saving} onClick={() => manage('restore')}>Återställ</button><button className="button button-danger" disabled={saving} onClick={() => manage('delete')}>Ta bort permanent</button></>}<button className="button button-primary" disabled={saving || Boolean(selected.archived_at) || !dirty} onClick={save} title="Spara (Ctrl+S)"><i className="ph ph-floppy-disk" aria-hidden="true" />{saving ? 'Sparar…' : 'Spara'}</button></div></div><AdminNotice message={message} tone={tone} onDismiss={() => setMessage('')} />
        {selected.archived_at && <p className="archive-notice">Arkiverades {new Date(selected.archived_at).toLocaleString('sv-SE')}. Återställ posten innan den redigeras.</p>}
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
          <label className="check"><input type="checkbox" disabled={Boolean(selected.archived_at)} checked={selected.is_published} onChange={(event) => setSelected({ ...selected, is_published: event.target.checked })} /> Publicerad</label>
        </div>
        {kind === 'news_posts' && <BlockEditor template="article" blocks={selected.body_blocks} media={media.filter((asset) => asset.mime_type.startsWith('image/'))} onChange={(body_blocks) => setSelected({ ...selected, body_blocks })} />}
      </> : <div className="empty-panel"><h1>Välj eller skapa innehåll</h1><p>Alla ändringar valideras på servern innan de sparas.</p></div>}
    </section>
  </div>;
}
