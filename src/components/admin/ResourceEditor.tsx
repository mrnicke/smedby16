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

const labels: Record<ResourceKind, { singular: string; definite: string; newTitle: string; existingLabel: string; plural: string; pluralNoun: string; icon: string; help: string }> = {
  news_posts: { singular: 'nyhet', definite: 'nyheten', newTitle: 'Ny nyhet', existingLabel: 'befintlig nyhet', plural: 'Nyheter', pluralNoun: 'nyheter', icon: 'ph-newspaper', help: 'Informera boende om vad som händer i området.' },
  calendar_events: { singular: 'aktivitet', definite: 'aktiviteten', newTitle: 'Ny aktivitet', existingLabel: 'befintlig aktivitet', plural: 'Kalender', pluralNoun: 'aktiviteter', icon: 'ph-calendar-dots', help: 'Lägg in möten, aktiviteter och viktiga datum.' },
  documents: { singular: 'dokument', definite: 'dokumentet', newTitle: 'Nytt dokument', existingLabel: 'befintligt dokument', plural: 'Dokument', pluralNoun: 'dokument', icon: 'ph-file-pdf', help: 'Publicera protokoll, stadgar och andra PDF-filer.' },
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

function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('sv-SE', includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
}

function resourceSummary(kind: ResourceKind, item: Resource) {
  if (kind === 'news_posts') return item.summary || 'Ingen sammanfattning ännu.';
  if (kind === 'calendar_events') return [formatDate(item.starts_at, true), item.location].filter(Boolean).join(' · ') || 'Datum och plats saknas.';
  return [item.category, formatDate(item.document_date)].filter(Boolean).join(' · ') || item.description || 'Ingen beskrivning ännu.';
}

function statusText(item: Resource) {
  return item.archived_at ? 'Arkiverad' : item.is_published ? 'Publicerad' : 'Inte publicerad';
}

function statusClass(item: Resource) {
  return `status-dot ${item.archived_at ? 'is-archived' : item.is_published ? 'is-published' : ''}`;
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

  useEffect(() => { setSelected(null); setBaseline(''); setMessage(''); setQuery(''); void load(); }, [kind]);
  const pdfMedia = useMemo(() => media.filter((asset) => asset.mime_type === 'application/pdf'), [media]);
  const imageMedia = useMemo(() => media.filter((asset) => asset.mime_type.startsWith('image/')), [media]);
  const filteredItems = useMemo(() => items.filter((item) => String(item.title).toLocaleLowerCase('sv-SE').includes(query.toLocaleLowerCase('sv-SE'))), [items, query]);
  const currentLabels = labels[kind];
  const possessiveTitle = currentLabels.definite[0].toLocaleUpperCase('sv-SE') + currentLabels.definite.slice(1) + 's';

  const create = () => { if (!confirmDiscard(dirty)) return; setSelected(createResourceDraft(kind)); setBaseline(''); setMessage(''); };
  const choose = (item: Resource) => { if (!confirmDiscard(dirty)) return; setSelected(item); setBaseline(JSON.stringify(item)); setMessage(''); };
  const showPicker = () => { if (!confirmDiscard(dirty)) return; setSelected(null); setBaseline(''); setMessage(''); setQuery(''); };

  const save = async () => {
    if (!selected || saving || selected.archived_at) return;
    setSaving(true); setTone('info'); setMessage('Kontrollerar och sparar…');
    try {
      if (kind === 'news_posts') blockListSchema.parse(selected.body_blocks);
      if (kind === 'documents' && !selected.media_id) throw new Error('Välj en uppladdad PDF innan dokumentet sparas.');
      if (kind === 'calendar_events' && selected.ends_at && new Date(selected.ends_at) < new Date(selected.starts_at)) throw new Error('Sluttiden måste vara efter starttiden.');
      const saved = await invokeSave(client, kind, selected);
      setSelected(saved); setBaseline(JSON.stringify(saved));
      setTone('success'); setMessage(saved.is_published ? `Klart – ${currentLabels.definite} är uppdaterad och syns direkt.` : `Klart – ${currentLabels.definite} är sparad utan att vara publicerad.`);
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
      setTone('success');
      if (action === 'delete') { setSelected(null); setMessage('Innehållet är permanent borttaget.'); await load(); }
      else { setSelected(result); setMessage(action === 'archive' ? 'Innehållet är arkiverat och syns inte längre publikt.' : 'Innehållet är återställt som opublicerat.'); await load(result.id); }
    } catch (error) { setTone('error'); setMessage(error instanceof Error ? error.message : 'Åtgärden kunde inte genomföras.'); }
    finally { setSaving(false); }
  };

  useSaveShortcut(dirty && !saving && !selected?.archived_at, save);
  if (loading) return <AdminLoading label={`Hämtar ${currentLabels.plural.toLocaleLowerCase('sv-SE')}`} />;

  if (!selected) return <section className="resource-picker admin-panel" aria-labelledby="resource-picker-title">
    <div className="resource-picker-header"><div><p className="eyebrow">{currentLabels.plural}</p><h1 id="resource-picker-title">Vad vill du göra?</h1><p>{currentLabels.help}</p></div><span className="page-count"><strong>{items.length}</strong> {items.length === 1 ? currentLabels.singular : currentLabels.pluralNoun}</span></div>
    <button type="button" className="resource-create-card" onClick={create}><span><i className={`ph ${currentLabels.icon}`} aria-hidden="true" /></span><span><strong>Skapa {currentLabels.newTitle.toLocaleLowerCase('sv-SE')}</strong><small>Börja med ett tomt formulär och publicera när du är klar.</small></span><i className="ph ph-plus-circle" aria-hidden="true" /></button>
    <div className="resource-list-heading"><div><h2>Ändra {currentLabels.existingLabel}</h2><p>Välj det innehåll du vill öppna.</p></div>{items.length > 4 && <label className="page-picker-search"><span className="sr-only">Sök {currentLabels.singular}</span><i className="ph ph-magnifying-glass" aria-hidden="true" /><input type="search" placeholder={`Sök bland ${currentLabels.pluralNoun}…`} value={query} onChange={(event) => setQuery(event.target.value)} /></label>}</div>
    <div className="resource-card-grid">{filteredItems.map((item) => <button type="button" className="resource-card" key={item.id} onClick={() => choose(item)} aria-label={`Ändra ${item.title}`}><span className="resource-card-icon"><i className={`ph ${currentLabels.icon}`} aria-hidden="true" /></span><span className="resource-card-copy"><strong>{item.title}</strong><span>{resourceSummary(kind, item)}</span><small><span className={statusClass(item)} />{statusText(item)}</small></span><span className="resource-card-action">Ändra <i className="ph ph-arrow-right" aria-hidden="true" /></span></button>)}</div>
    {filteredItems.length === 0 && <div className="empty-state"><i className={`ph ${currentLabels.icon}`} aria-hidden="true" /><strong>{items.length ? 'Inget innehåll hittades' : `Inga ${currentLabels.pluralNoun} ännu`}</strong><p>{items.length ? 'Prova ett annat sökord.' : `Välj “Skapa ${currentLabels.newTitle.toLocaleLowerCase('sv-SE')}” för att komma igång.`}</p></div>}
  </section>;

  const heading = selected.id ? selected.title : currentLabels.newTitle;
  return <section className="resource-editor-page admin-panel">
    <button className="page-editor-back" type="button" onClick={showPicker}><i className="ph ph-arrow-left" aria-hidden="true" />Alla {currentLabels.pluralNoun}</button>
    <div className="admin-heading page-editor-heading"><div><p className="eyebrow">{selected.archived_at ? 'Arkiverat innehåll' : selected.id ? `Ändra ${currentLabels.singular}` : `Skapa ${currentLabels.singular}`}</p><h1>{heading}</h1><p>Fyll i de vanligaste uppgifterna först. Fler val finns under inställningar längre ned.</p></div>{!selected.archived_at && <span className={selected.is_published ? 'page-publication-state is-published' : 'page-publication-state'}><span className={selected.is_published ? 'status-dot is-published' : 'status-dot'} />{selected.is_published ? 'Synlig på webbplatsen' : 'Inte publicerad'}</span>}</div>
    <AdminNotice message={message} tone={tone} onDismiss={() => setMessage('')} />

    {selected.archived_at ? <div className="archived-resource-panel"><i className="ph ph-archive" aria-hidden="true" /><h2>{selected.title}</h2><p>Arkiverades {formatDate(selected.archived_at, true)}. Återställ innehållet för att kunna ändra det igen.</p><div className="admin-actions"><button className="button button-primary" disabled={saving} onClick={() => manage('restore')}><i className="ph ph-arrow-counter-clockwise" aria-hidden="true" />Återställ som opublicerad</button><button className="button button-danger" disabled={saving} onClick={() => manage('delete')}><i className="ph ph-trash" aria-hidden="true" />Ta bort permanent</button></div></div> : <>
      <div className="resource-form-section"><div className="section-heading"><div><p className="eyebrow">Grunduppgifter</p><h2>{possessiveTitle} innehåll</h2><p>Det här är informationen som besökaren ser.</p></div></div><div className="field-grid">
        <label className={kind === 'calendar_events' ? 'span-two' : ''}>Rubrik<input value={selected.title} maxLength={160} onChange={(event) => setSelected({ ...selected, title: event.target.value })} /></label>
        {kind === 'news_posts' && <label className="span-two">Kort sammanfattning<textarea value={selected.summary} maxLength={600} onChange={(event) => setSelected({ ...selected, summary: event.target.value })} /></label>}
        {kind === 'calendar_events' && <><label>Start<input type="datetime-local" value={localDateTime(selected.starts_at)} onChange={(event) => setSelected({ ...selected, starts_at: isoDateTime(event.target.value) })} /></label><label>Slut (valfri)<input type="datetime-local" value={localDateTime(selected.ends_at)} onChange={(event) => setSelected({ ...selected, ends_at: isoDateTime(event.target.value) })} /></label><label className="span-two">Beskrivning<textarea value={selected.description} maxLength={2500} onChange={(event) => setSelected({ ...selected, description: event.target.value })} /></label><label className="span-two">Plats<input value={selected.location ?? ''} onChange={(event) => setSelected({ ...selected, location: event.target.value || null })} /></label></>}
        {kind === 'documents' && <><label className="span-two">Beskrivning<textarea value={selected.description} maxLength={1000} onChange={(event) => setSelected({ ...selected, description: event.target.value })} /></label><label className="span-two">PDF-fil<select value={selected.media_id} onChange={(event) => setSelected({ ...selected, media_id: event.target.value })}><option value="">Välj en uppladdad PDF</option>{pdfMedia.map((asset) => <option value={asset.id} key={asset.id}>{asset.original_name}</option>)}</select>{pdfMedia.length === 0 && <small>Ladda först upp en PDF under Media.</small>}</label></>}
      </div></div>

      {kind === 'news_posts' && <BlockEditor template="article" blocks={selected.body_blocks} media={imageMedia} onChange={(body_blocks) => setSelected({ ...selected, body_blocks })} />}

      <details className="advanced-settings resource-settings"><summary><span className="advanced-settings-icon"><i className="ph ph-sliders-horizontal" aria-hidden="true" /></span><span><strong>Inställningar</strong><small>Publicering och mindre vanliga val</small></span><i className="ph ph-caret-down" aria-hidden="true" /></summary><div className="editor-section advanced-settings-body"><div className="field-grid">
        {kind === 'news_posts' && <><label>Webbadress<input value={selected.slug} pattern="[a-z0-9-]+" onChange={(event) => setSelected({ ...selected, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /><small>Använd små bokstäver och bindestreck.</small></label><label>Publiceringsdatum<input type="datetime-local" value={localDateTime(selected.published_at)} onChange={(event) => setSelected({ ...selected, published_at: isoDateTime(event.target.value) })} /></label><label className="span-two">Huvudbild (valfri)<select value={selected.hero_media_id ?? ''} onChange={(event) => setSelected({ ...selected, hero_media_id: event.target.value || null })}><option value="">Ingen bild</option>{imageMedia.map((asset) => <option value={asset.id} key={asset.id}>{asset.original_name}</option>)}</select></label></>}
        {kind === 'calendar_events' && <><label>Kategori<select value={selected.category} onChange={(event) => setSelected({ ...selected, category: event.target.value })}>{['möte', 'aktivitet', 'underhåll', 'information'].map((category) => <option value={category} key={category}>{category}</option>)}</select></label><label className="check"><input type="checkbox" checked={selected.all_day} onChange={(event) => setSelected({ ...selected, all_day: event.target.checked })} /> Aktiviteten pågår hela dagen</label><label className="span-two">Länk till mer information (valfri)<input type="url" placeholder="https://…" value={selected.external_url ?? ''} onChange={(event) => setSelected({ ...selected, external_url: event.target.value || null })} /></label></>}
        {kind === 'documents' && <><label>Dokumentdatum<input type="date" value={selected.document_date ?? ''} onChange={(event) => setSelected({ ...selected, document_date: event.target.value || null })} /></label><label>Kategori<input value={selected.category} onChange={(event) => setSelected({ ...selected, category: event.target.value })} /></label><label>Sorteringsordning<input type="number" value={selected.sort_order} onChange={(event) => setSelected({ ...selected, sort_order: Number(event.target.value) })} /><small>Lägre nummer visas först.</small></label></>}
        <label className="check publish-toggle"><input type="checkbox" checked={selected.is_published} onChange={(event) => setSelected({ ...selected, is_published: event.target.checked })} /><span><strong>Visa på webbplatsen</strong><small>Avmarkera för att spara utan att publicera.</small></span></label>
      </div>{selected.id && <div className="resource-danger-zone"><div><strong>Arkivera innehållet</strong><small>Innehållet försvinner från webbplatsen men kan återställas senare.</small></div><button className="button button-secondary" disabled={saving} onClick={() => manage('archive')}><i className="ph ph-archive" aria-hidden="true" />Arkivera</button></div>}</div></details>

      <div className={`editor-save-bar ${dirty ? 'has-changes' : ''}`} role="region" aria-label="Spara ändringar"><div>{saving ? <i className="ph ph-spinner-gap" aria-hidden="true" /> : dirty ? <i className="ph ph-pencil-simple" aria-hidden="true" /> : <i className="ph ph-check-circle" aria-hidden="true" />}<span><strong>{saving ? 'Sparar ändringarna…' : dirty ? 'Du har osparade ändringar' : 'Alla ändringar är sparade'}</strong><small>{dirty ? 'Spara när du är nöjd.' : 'Du kan tryggt lämna sidan.'}</small></span></div><button className="button button-primary" disabled={saving || !dirty} onClick={save} title="Spara ändringar (Ctrl+S)"><i className="ph ph-floppy-disk" aria-hidden="true" />{saving ? 'Sparar…' : selected.is_published ? 'Spara och publicera' : 'Spara ändringar'}</button></div>
    </>}
  </section>;
}
