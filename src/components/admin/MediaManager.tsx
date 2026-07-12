import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

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

  const load = async () => {
    const { data, error } = await client.from('media_assets').select('*').is('deleted_at', null).order('created_at', { ascending: false });
    if (error) { setMessage('Mediebiblioteket kunde inte hämtas.'); return; }
    setItems(data ?? []);
    if (selected) setSelected((data ?? []).find((item) => item.id === selected.id) ?? null);
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
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const uploadAlt = (form.elements.namedItem('upload-alt') as HTMLInputElement).value.trim();
    const file = input.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg','image/png','image/webp','image/avif','application/pdf'];
    if (!allowed.includes(file.type) || file.size > 26_214_400) { setMessage('Välj en bild eller PDF under 25 MB.'); return; }
    if (file.type.startsWith('image/') && !uploadAlt) { setMessage('Beskriv bilden med alt-text.'); return; }
    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const storagePath = `${file.type === 'application/pdf' ? 'documents' : 'images'}/${crypto.randomUUID()}.${extension}`;
    setBusy(true); setMessage('Laddar upp…');
    const { error } = await client.storage.from('public-media').upload(storagePath, file, { contentType: file.type, upsert: false });
    if (error) { setBusy(false); setMessage('Filen kunde inte laddas upp.'); return; }
    try {
      await invoke(client, 'save-content', { entity: 'media_assets', payload: { storage_path: storagePath, original_name: file.name, mime_type: file.type, size_bytes: file.size, alt_text: uploadAlt } });
      input.value = ''; form.reset(); setMessage('Filen är uppladdad.'); await load();
    } catch (error) {
      await client.storage.from('public-media').remove([storagePath]);
      setMessage(error instanceof Error ? error.message : 'Uppladdningen återställdes.');
    } finally { setBusy(false); }
  };
  const saveAlt = async () => {
    if (!selected || (selected.mime_type.startsWith('image/') && !alt.trim())) { setMessage('Bilder måste ha alt-text.'); return; }
    setBusy(true);
    try {
      const saved = await invoke(client, 'save-content', { entity: 'media_assets', payload: { ...selected, alt_text: alt.trim() } });
      setSelected(saved); setMessage('Filinformationen är sparad.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Filinformationen kunde inte sparas.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!selected) return;
    if (references.length) { setMessage(`Filen används i: ${references.map((item) => item.source).join(', ')}.`); return; }
    if (!confirm(`Ta bort ${selected.original_name} permanent? Detta kan inte ångras.`)) return;
    setBusy(true);
    try { await invoke(client, 'manage-media', { id: selected.id, action: 'delete' }); setSelected(null); setMessage('Filen är borttagen.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Filen kunde inte tas bort.'); }
    finally { setBusy(false); }
  };

  return <section className="admin-panel media-manager">
    <div className="admin-heading"><div><p className="eyebrow">Bilder och dokument</p><h1>Mediebibliotek</h1></div></div>
    <form className="upload-form" onSubmit={upload}>
      <label>Bild eller PDF<input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif,application/pdf" required /></label>
      <label>Alt-text för bilder<input name="upload-alt" maxLength={240} /></label>
      <button className="button button-primary" disabled={busy}>Ladda upp</button>
    </form>
    {message && <p role="status" className="save-message">{message}</p>}
    <div className="media-layout">
      <div className="media-grid">{items.map((item) => <button type="button" className={selected?.id === item.id ? 'is-selected' : ''} key={item.id} onClick={() => { setSelected(item); setMessage(''); }}>
        {item.mime_type.startsWith('image/') ? <img src={client.storage.from('public-media').getPublicUrl(item.storage_path).data.publicUrl} alt={item.alt_text} /> : <span className="pdf-icon">PDF</span>}
        <strong>{item.original_name}</strong><small>{Math.ceil(item.size_bytes / 1024)} kB</small>
      </button>)}</div>
      {selected && <aside className="media-details"><h2>{selected.original_name}</h2>{selected.mime_type.startsWith('image/') && <img src={publicUrl} alt={selected.alt_text} />}
        <label>Alt-text<input value={alt} maxLength={240} onChange={(event) => setAlt(event.target.value)} /></label>
        <p><strong>Användning:</strong> {references.length ? references.map((item) => `${item.source} (${item.reference_count})`).join(', ') : 'Ingen aktuell referens'}</p>
        <div className="admin-actions"><button type="button" onClick={saveAlt} disabled={busy}>Spara information</button><button type="button" onClick={() => navigator.clipboard.writeText(publicUrl)}>Kopiera publik URL</button><button type="button" className="danger" onClick={remove} disabled={busy || references.length > 0}>Ta bort permanent</button></div>
      </aside>}
    </div>
  </section>;
}
