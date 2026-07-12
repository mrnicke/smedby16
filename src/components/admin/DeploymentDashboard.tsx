import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

type Deployment = { id: string; status: 'queued'|'in_progress'|'success'|'failed'; trigger_type: 'nightly'|'manual'|'code'; started_at: string; completed_at: string | null; external_run_id: number | null; error_summary: string | null };
const statusLabels = { queued: 'I kö', in_progress: 'Bygger', success: 'Klar', failed: 'Misslyckad' };
const countLabels: Record<string, string> = { pages: 'Sidor', news_posts: 'Nyheter', calendar_events: 'Kalenderposter', documents: 'Dokument', media_assets: 'Mediafiler' };

export default function DeploymentDashboard({ client }: { client: SupabaseClient }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [message, setMessage] = useState('');
  const [triggering, setTriggering] = useState(false);
  const load = async () => {
    const countEntries = await Promise.all(Object.keys(countLabels).map(async (table) => {
      let query = client.from(table).select('*', { count: 'exact', head: true });
      if (table === 'media_assets') query = query.is('deleted_at', null);
      if (['news_posts','calendar_events','documents'].includes(table)) query = query.is('archived_at', null);
      const { count } = await query; return [table, count ?? 0] as const;
    }));
    setCounts(Object.fromEntries(countEntries));
    const { data } = await client.from('snapshot_deployments').select('*').order('started_at', { ascending: false }).limit(10);
    setDeployments(data ?? []);
  };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10_000); return () => window.clearInterval(timer); }, []);
  const trigger = async () => { setTriggering(true); setMessage('Startar snapshot-bygget…'); const { data, error } = await client.functions.invoke('trigger-pages-build'); setMessage(error ? data?.error ?? 'Bygget kunde inte startas.' : 'Bygget är lagt i kö. Status uppdateras automatiskt.'); setTriggering(false); await load(); };
  return <section className="admin-panel deployment-dashboard"><div className="admin-heading"><div><p className="eyebrow">Smedby 1:6</p><h1>Översikt</h1></div><button className="button button-primary" disabled={triggering} onClick={trigger}>{triggering ? 'Startar…' : 'Uppdatera statisk snapshot'}</button></div>
    <div className="stat-grid">{Object.entries(counts).map(([key, value]) => <article key={key}><strong>{value}</strong><span>{countLabels[key]}</span></article>)}</div>{message && <p role="status" className="save-message">{message}</p>}
    <div className="admin-heading"><div><h2>Senaste byggen</h2><p>Status hämtas automatiskt var tionde sekund.</p></div><button type="button" onClick={load}>Uppdatera nu</button></div>
    <div className="deployment-list">{deployments.length ? deployments.map((item) => <article className={`deployment-status status-${item.status}`} key={item.id}><div><strong>{statusLabels[item.status]}</strong><span>{item.trigger_type} · {new Date(item.started_at).toLocaleString('sv-SE')}</span>{item.error_summary && <small>{item.error_summary}</small>}</div>{item.external_run_id && <a href={`https://github.com/mrnicke/smedby16/actions/runs/${item.external_run_id}`}>Visa på GitHub</a>}</article>) : <p>Inga byggen har registrerats ännu.</p>}</div>
  </section>;
}
