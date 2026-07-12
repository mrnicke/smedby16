import { useState, type SyntheticEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminNotice, type NoticeTone } from './AdminFeedback';
import { uploadMediaAsset, validateMediaUpload, type UploadedMediaAsset, type UploadKind } from './mediaUpload';

function fileSize(size: number) {
  return size < 1_048_576 ? `${Math.ceil(size / 1024)} kB` : `${(size / 1_048_576).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} MB`;
}

export default function InlineMediaUpload({ client, kind, onUploaded }: { client: SupabaseClient; kind: UploadKind; onUploaded: (asset: UploadedMediaAsset) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<NoticeTone>('info');
  const isImage = kind === 'image';

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) { setTone('error'); setMessage(isImage ? 'Välj en bild att ladda upp.' : 'Välj en PDF-fil att ladda upp.'); return; }
    const validationError = validateMediaUpload(file, kind, altText);
    if (validationError) { setTone('error'); setMessage(validationError); return; }
    setBusy(true); setTone('info'); setMessage(isImage ? 'Laddar upp bilden…' : 'Laddar upp PDF-filen…');
    try {
      const asset = await uploadMediaAsset(client, file, kind, altText);
      onUploaded(asset);
      form.reset(); setFile(null); setAltText(''); setTone('success'); setMessage(isImage ? 'Klart – bilden är uppladdad och vald.' : 'Klart – PDF-filen är uppladdad och vald.');
    } catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'Uppladdningen kunde inte slutföras.'); }
    finally { setBusy(false); }
  };

  return <details className="inline-media-upload"><summary><span><i className={`ph ${isImage ? 'ph-image' : 'ph-file-pdf'}`} aria-hidden="true" /></span><span><strong>{isImage ? 'Ladda upp en ny bild' : 'Ladda upp en ny PDF'}</strong><small>{isImage ? 'JPEG, PNG, WebP eller AVIF · högst 25 MB' : 'PDF · högst 25 MB'}</small></span><i className="ph ph-caret-down" aria-hidden="true" /></summary><form onSubmit={submit}><label>{isImage ? 'Välj bild' : 'Välj PDF-fil'}<input type="file" accept={isImage ? 'image/jpeg,image/png,image/webp,image/avif' : 'application/pdf'} onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); setMessage(''); }} /></label>{file && <div className="selected-upload-file"><i className={`ph ${isImage ? 'ph-image' : 'ph-file-pdf'}`} aria-hidden="true" /><span><strong>{file.name}</strong><small>{fileSize(file.size)}</small></span></div>}{isImage && <label>Beskriv bilden<input value={altText} maxLength={240} onChange={(event) => setAltText(event.target.value)} placeholder="Exempel: Lekplatsen vid områdets södra gångväg" /><small>Beskriv kort vad bilden visar. Texten hjälper personer som använder skärmläsare.</small></label>}<button className="button button-secondary" disabled={busy || !file}><i className="ph ph-upload-simple" aria-hidden="true" />{busy ? 'Laddar upp…' : 'Ladda upp och välj'}</button><AdminNotice message={message} tone={tone} onDismiss={() => setMessage('')} /></form></details>;
}
