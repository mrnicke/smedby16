import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revisionChanges } from '../../lib/cms/revisions';

type Revision = { id: string; entity_type: string; entity_id: string; revision_no: number; snapshot: Record<string, unknown>; created_at: string; restored_from_id: string | null };
function display(value: unknown) { if (value === undefined) return '—'; if (typeof value === 'string') return value; return JSON.stringify(value, null, 2); }
function revisionLabel(item: Revision) { return String(item.snapshot.title ?? item.snapshot.original_name ?? item.entity_type); }

export default function RevisionHistory({ client }: { client: SupabaseClient }) {
  const [items, setItems] = useState<Revision[]>([]);
  const [selected, setSelected] = useState<Revision | null>(null);
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const load = async () => { const { data, error } = await client.from('content_revisions').select('*').order('created_at', { ascending: false }).limit(200); if (error) setMessage('Versionshistoriken kunde inte hämtas.'); else setItems(data ?? []); };
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => filter === 'all' ? items : items.filter((item) => item.entity_type === filter), [items, filter]);
  const previous = selected ? items.find((item) => item.entity_type === selected.entity_type && item.entity_id === selected.entity_id && item.revision_no === selected.revision_no - 1) ?? null : null;
  const changes = selected ? revisionChanges(previous?.snapshot ?? null, selected.snapshot) : [];
  const restore = async () => {
    if (!selected || !confirm(`Återställa revision ${selected.revision_no} som aktuell version?`)) return;
    const { data, error } = await client.functions.invoke('restore-revision', { body: { revisionId: selected.id } });
    setMessage(error ? data?.error ?? 'Revisionen kunde inte återställas.' : 'Revisionen är återställd som en ny version.');
    if (!error) await load();
  };
  return <section className="admin-panel revision-panel"><div className="admin-heading"><div><p className="eyebrow">Spårbara ändringar</p><h1>Versionshistorik</h1></div><label>Innehållstyp<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Alla</option>{['pages','news_posts','calendar_events','documents','media_assets','navigation_items','site_settings'].map((type) => <option key={type}>{type}</option>)}</select></label></div>
    {message && <p role="status" className="save-message">{message}</p>}
    <div className="revision-layout"><div className="revision-list">{filtered.map((item) => <button type="button" className={selected?.id === item.id ? 'is-selected' : ''} key={item.id} onClick={() => setSelected(item)}><strong>{revisionLabel(item)}</strong><span>{item.entity_type} · revision {item.revision_no}</span><small>{new Date(item.created_at).toLocaleString('sv-SE')}{item.restored_from_id ? ' · återställning' : ''}</small></button>)}</div>
      {selected && <aside className="revision-diff"><div className="admin-heading"><div><h2>Ändringar i revision {selected.revision_no}</h2><p>Jämfört med föregående version av samma post.</p></div><button type="button" className="button button-primary" onClick={restore}>Återställ</button></div>{changes.length ? changes.map((change) => <article key={change.field}><h3>{change.field}</h3><div><section><strong>Före</strong><pre>{display(change.before)}</pre></section><section><strong>Efter</strong><pre>{display(change.after)}</pre></section></div></article>) : <p>Detta är den första versionen eller så saknas jämförbara ändringar.</p>}</aside>}
    </div>
  </section>;
}
