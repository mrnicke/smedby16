import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminLoading, AdminNotice, type NoticeTone } from './AdminFeedback';
import { confirmDiscard, useUnsavedChanges } from './useUnsavedChanges';
import { ACCEPTED_MEDIA_TYPES, uploadMediaAsset } from './mediaUpload';

type MediaAsset = {
  id: string; storage_path: string; original_name: string; mime_type: string; size_bytes: number;
  width: number | null; height: number | null; alt_text: string;
};
type Reference = { source: string; reference_count: number | string };

async function invoke(client: SupabaseClient, name: string, body: Record<string, any>) {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) throw new Error(data?.error ?? error.message);
  return data?.data;
}

export default function MediaManager({ client }: { client: SupabaseClient }) {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [references, setReferences] = useState<Reference[]>([]);
  const [alt, setAlt] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all'|'images'|'pdf'>('all');
  const [loading, setLoading] = useState(true);
  const [tone, setTone] = useState<NoticeTone>('info');
  const dirty = Boolean(selected && alt !== selected.alt_text);
  useUnsavedChanges(dirty);

  const load = async () => {
    const { data, error } = await client.from('media_assets').select('*').is('deleted_at', null).order('created_at', { ascending: false });
    if (error) { setTone('error'); setMessage('Mediebiblioteket kunde inte hämtas. Försök igen.'); setLoading(false); return; }
    setItems(data ?? []);
    if (selected) setSelected((data ?? []).find((item) => item.id === selected.id) ?? null);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!selected) { setReferences([]); return; }
    setAlt(selected.alt_text);
    invoke(client, 'manage-media', { id: selected.id, action: 'usage' })
      .then((data) => setReferences(data?.references ?? []))
      .catch(() => setMessage('Filens användning kunde inte kontrolleras.'));
  }, [selected?.id]);

  const publicUrl = useMemo(() => selected ? client.storage.from('public-media').getPublicUrl(selected.storage_path).data.publicUrl : '', [client, selected]);
  const filteredItems = useMemo(() => items.filter((item) => item.original_name.toLocaleLowerCase('sv-SE').includes(query.toLocaleLowerCase('sv-SE')) && (typeFilter === 'all' || typeFilter === 'images' && item.mime_type.startsWith('image/') || typeFilter === 'pdf' && item.mime_type === 'application/pdf')), [items, query, typeFilter]);
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const uploadAlt = (form.elements.namedItem('upload-alt') as HTMLInputElement).value.trim();
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true); setTone('info'); setMessage('Laddar upp filen…');
    try {
      await uploadMediaAsset(client,file,file.type==='application/pdf'?'pdf':'image',uploadAlt);
      input.value = ''; form.reset(); setTone('success'); setMessage('Klart! Filen finns nu i mediebiblioteket.'); await load();
    } catch (error) {
      setTone('error'); setMessage(error instanceof Error ? error.message : 'Uppladdningen kunde inte slutföras.');
    } finally { setBusy(false); }
  };
  const saveAlt = async () => {
    if (!selected || (selected.mime_type.startsWith('image/') && !alt.trim())) { setTone('error'); setMessage('Bilder måste ha en beskrivande alt-text.'); return; }
    setBusy(true);
    try {
      const saved = await invoke(client, 'save-content', { entity: 'media_assets', payload: { id: selected.id, alt_text: alt.trim() } });
      setSelected(saved); setTone('success'); setMessage('Filinformationen är sparad.'); await load();
    } catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'Filinformationen kunde inte sparas.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!selected) return;
    if (references.length) { setTone('warning'); setMessage(`Filen används i: ${references.map((item) => item.source).join(', ')}.`); return; }
    if (!confirm(`Ta bort ${selected.original_name} permanent? Detta kan inte ångras.`)) return;
    setBusy(true);
    try { await invoke(client, 'manage-media', { id: selected.id, action: 'delete' }); setSelected(null); setTone('success'); setMessage('Filen är permanent borttagen.'); await load(); }
    catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'Filen kunde inte tas bort.'); }
    finally { setBusy(false); }
  };

  if (loading) return <AdminLoading label="Hämtar mediebiblioteket" />;
  return <section className="admin-panel media-manager">
    <div className="admin-page-header"><div><p className="eyebrow">Bilder och dokument</p><h1>Mediebibliotek</h1><p>Ladda upp filer och håll bildernas alt-texter uppdaterade.</p></div></div>
    <form className="upload-form" onSubmit={upload}>
      <label>Bild eller PDF<input name="file" type="file" accept={ACCEPTED_MEDIA_TYPES} required /></label>
      <label>Alt-text för bilder<input name="upload-alt" maxLength={240} /><small>Beskriv bildens innehåll och funktion kort.</small></label>
      <button className="button button-primary" disabled={busy}><i className="ph ph-upload-simple" aria-hidden="true" />{busy ? 'Laddar upp…' : 'Ladda upp'}</button>
    </form>
    <AdminNotice message={message} tone={tone} onDismiss={() => setMessage('')} />
    <div className="media-toolbar"><label className="sidebar-search"><span className="sr-only">Sök fil</span><i className="ph ph-magnifying-glass" aria-hidden="true" /><input type="search" placeholder="Sök filnamn…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="filter-chips" role="group" aria-label="Filtyp">{(['all','images','pdf'] as const).map((value) => <button type="button" aria-pressed={typeFilter === value} className={typeFilter === value ? 'is-active' : ''} key={value} onClick={() => setTypeFilter(value)}>{value === 'all' ? 'Alla' : value === 'images' ? 'Bilder' : 'PDF'}</button>)}</div></div>
    <div className="media-layout">
      <div className="media-grid">{filteredItems.map((item) => <button type="button" className={selected?.id === item.id ? 'is-selected' : ''} key={item.id} onClick={() => { if (!confirmDiscard(dirty)) return; setSelected(item); setMessage(''); }}>
        {item.mime_type.startsWith('image/') ? <img src={client.storage.from('public-media').getPublicUrl(item.storage_path).data.publicUrl} alt={item.alt_text} /> : <span className="pdf-icon">PDF</span>}
        <strong>{item.original_name}</strong><small>{Math.ceil(item.size_bytes / 1024)} kB</small>
      </button>)}{filteredItems.length === 0 && <div className="empty-state"><i className="ph ph-image" aria-hidden="true" /><p>Inga filer matchar filtret.</p></div>}</div>
      {selected && <aside className="media-details"><h2>{selected.original_name}</h2>{selected.mime_type.startsWith('image/') && <img src={publicUrl} alt={selected.alt_text} />}
        <label>Alt-text<input value={alt} maxLength={240} onChange={(event) => setAlt(event.target.value)} /></label>
        <p><strong>Användning:</strong> {references.length ? references.map((item) => `${item.source} (${item.reference_count})`).join(', ') : 'Ingen aktuell referens'}</p>
        <div className="admin-actions"><button type="button" onClick={saveAlt} disabled={busy}>Spara information</button><button type="button" onClick={() => navigator.clipboard.writeText(publicUrl)}>Kopiera publik URL</button><button type="button" className="danger" onClick={remove} disabled={busy || references.length > 0}>Ta bort permanent</button></div>
      </aside>}
    </div>
  </section>;
}
