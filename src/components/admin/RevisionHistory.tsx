import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revisionChanges } from '../../lib/cms/revisions';
import { AdminLoading, AdminNotice, type NoticeTone } from './AdminFeedback';

type Revision = { id: string; entity_type: string; entity_id: string; revision_no: number; snapshot: Record<string, unknown>; created_at: string; restored_from_id: string | null };
function display(value: unknown) { if (value === undefined) return '—'; if (typeof value === 'string') return value; return JSON.stringify(value, null, 2); }
function revisionLabel(item: Revision) { return String(item.snapshot.title ?? item.snapshot.original_name ?? item.entity_type); }
const typeLabels: Record<string, string> = { pages: 'Sidor', news_posts: 'Nyheter', calendar_events: 'Kalender', documents: 'Dokument', media_assets: 'Media', navigation_items: 'Navigation', site_settings: 'Inställningar' };

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
  const changes = selected ? revisionChanges(previous?.snapshot ?? null, selected.snapshot) : [];
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
      {selected ? <aside className="revision-diff"><div className="admin-heading"><div><p className="eyebrow">Revision {selected.revision_no}</p><h2>Vad ändrades?</h2><p>Jämfört med föregående version av samma post.</p></div><button type="button" className="button button-primary" onClick={restore}><i className="ph ph-clock-counter-clockwise" aria-hidden="true" />Återställ denna version</button></div>{changes.length ? changes.map((change) => <article key={change.field}><h3>{change.field}</h3><div><section><strong>Före</strong><pre>{display(change.before)}</pre></section><section><strong>Efter</strong><pre>{display(change.after)}</pre></section></div></article>) : <div className="empty-state"><i className="ph ph-file-dashed" aria-hidden="true" /><p>Detta är den första versionen eller så saknas jämförbara ändringar.</p></div>}</aside> : <div className="empty-state revision-empty"><i className="ph ph-cursor-click" aria-hidden="true" /><p>Välj en version för att se vad som ändrades.</p></div>}
    </div>
  </section>;
}
