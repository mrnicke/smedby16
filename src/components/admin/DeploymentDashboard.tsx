import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminLoading, AdminNotice, type NoticeTone } from './AdminFeedback';

type Deployment = { id: string; status: 'queued'|'in_progress'|'success'|'failed'; trigger_type: 'nightly'|'manual'|'code'; started_at: string; completed_at: string | null; external_run_id: number | null; error_summary: string | null };
type DashboardTab = 'pages'|'news'|'calendar'|'documents'|'media';
type Revision = { id: string; entity_type: string; created_at: string; snapshot: Record<string, unknown> };
const statusLabels = { queued: 'I kö', in_progress: 'Bygger', success: 'Klar', failed: 'Misslyckad' };
const countLabels: Record<string, string> = { pages: 'Sidor', news_posts: 'Nyheter', calendar_events: 'Kalenderposter', documents: 'Dokument', media_assets: 'Mediafiler' };
const countTabs: Record<string, DashboardTab> = { pages: 'pages', news_posts: 'news', calendar_events: 'calendar', documents: 'documents', media_assets: 'media' };
const contentLabels: Record<string, string> = { pages: 'Sida', news_posts: 'Nyhet', calendar_events: 'Kalenderpost', documents: 'Dokument', media_assets: 'Mediafil', navigation_items: 'Navigation', site_settings: 'Inställningar' };

export default function DeploymentDashboard({ client, onNavigate }: { client: SupabaseClient; onNavigate: (tab: DashboardTab) => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<NoticeTone>('info');
  const [triggering, setTriggering] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    const countEntries = await Promise.all(Object.keys(countLabels).map(async (table) => {
      let query = client.from(table).select('*', { count: 'exact', head: true });
      if (table === 'media_assets') query = query.is('deleted_at', null);
      if (['news_posts','calendar_events','documents'].includes(table)) query = query.is('archived_at', null);
      const { count } = await query; return [table, count ?? 0] as const;
    }));
    setCounts(Object.fromEntries(countEntries));
    const [{ data: deploymentRows }, { data: revisionRows }] = await Promise.all([
      client.from('snapshot_deployments').select('*').order('started_at', { ascending: false }).limit(5),
      client.from('content_revisions').select('id,entity_type,created_at,snapshot').order('created_at', { ascending: false }).limit(6),
    ]);
    setDeployments(deploymentRows ?? []); setRevisions(revisionRows ?? []); setLoading(false);
  };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10_000); return () => window.clearInterval(timer); }, []);
  const trigger = async () => { setTriggering(true); setTone('info'); setMessage('Startar uppdateringen av webbplatskopian…'); const { data, error } = await client.functions.invoke('trigger-pages-build'); setTone(error ? 'error' : 'success'); setMessage(error ? data?.error ?? 'Webbplatskopian kunde inte uppdateras.' : 'Uppdateringen är startad. Du kan fortsätta arbeta medan den körs.'); setTriggering(false); await load(); };
  if (loading) return <AdminLoading label="Hämtar översikten" />;
  return <section className="admin-panel deployment-dashboard"><div className="admin-page-header"><div><p className="eyebrow">God dag</p><h1>Översikt</h1><p>Här ser du innehållet och vad som nyligen har ändrats.</p></div><button className="button button-primary" disabled={triggering} onClick={trigger}><i className="ph ph-arrows-clockwise" aria-hidden="true" />{triggering ? 'Startar…' : 'Uppdatera webbplatskopian'}</button></div>
    <AdminNotice message={message} tone={tone} onDismiss={() => setMessage('')} />
    <section aria-labelledby="content-summary"><div className="section-heading"><div><h2 id="content-summary">Innehåll</h2><p>Välj en kategori för att öppna den.</p></div></div><div className="stat-grid">{Object.entries(counts).map(([key, value]) => <button type="button" key={key} onClick={() => onNavigate(countTabs[key])}><span className="stat-icon"><i className={`ph ${key === 'pages' ? 'ph-file-text' : key === 'news_posts' ? 'ph-newspaper' : key === 'calendar_events' ? 'ph-calendar-dots' : key === 'documents' ? 'ph-files' : 'ph-image'}`} aria-hidden="true" /></span><strong>{value}</strong><span>{countLabels[key]}</span><i className="ph ph-caret-right" aria-hidden="true" /></button>)}</div></section>
    <div className="dashboard-columns"><section aria-labelledby="recent-heading"><div className="section-heading"><div><h2 id="recent-heading">Senast ändrat</h2><p>De senaste sparade versionerna.</p></div></div><div className="recent-list">{revisions.length ? revisions.map((item) => <article key={item.id}><span className="recent-icon"><i className="ph ph-pencil-simple" aria-hidden="true" /></span><div><strong>{String(item.snapshot.title ?? item.snapshot.original_name ?? contentLabels[item.entity_type] ?? 'Innehåll')}</strong><small>{contentLabels[item.entity_type] ?? item.entity_type} · {new Date(item.created_at).toLocaleString('sv-SE')}</small></div></article>) : <div className="empty-state"><i className="ph ph-clock-counter-clockwise" aria-hidden="true" /><p>Inga ändringar har registrerats ännu.</p></div>}</div></section>
      <section aria-labelledby="backup-heading"><div className="section-heading"><div><h2 id="backup-heading">Webbplatskopia</h2><p>En reservkopia byggs automatiskt. Den publika webbplatsen uppdateras direkt när du sparar.</p></div><button className="button button-secondary" type="button" onClick={load}><i className="ph ph-arrow-clockwise" aria-hidden="true" />Uppdatera status</button></div><div className="deployment-list">{deployments.length ? deployments.map((item) => <article className={`deployment-status status-${item.status}`} key={item.id}><span className="deployment-icon"><i className={`ph ${item.status === 'success' ? 'ph-check-circle' : item.status === 'failed' ? 'ph-warning-circle' : 'ph-spinner-gap'}`} aria-hidden="true" /></span><div><strong>{statusLabels[item.status]}</strong><span>{new Date(item.started_at).toLocaleString('sv-SE')}</span>{item.error_summary && <small>{item.error_summary}</small>}</div>{item.external_run_id && <a href={`https://github.com/mrnicke/smedby16/actions/runs/${item.external_run_id}`} target="_blank" rel="noreferrer" aria-label="Visa bygget på GitHub"><i className="ph ph-arrow-square-out" aria-hidden="true" /></a>}</article>) : <div className="empty-state"><i className="ph ph-cloud-check" aria-hidden="true" /><p>Ingen webbplatskopia har byggts från admin ännu.</p></div>}</div></section></div>
  </section>;
}
