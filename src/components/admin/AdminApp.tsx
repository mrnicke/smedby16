import { useEffect, useState, type SyntheticEvent } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import DeploymentDashboard from './DeploymentDashboard';
import MediaManager from './MediaManager';
import NavigationManager from './NavigationManager';
import PagesManager from './PagesManager';
import ResourceEditor from './ResourceEditor';
import RevisionHistory from './RevisionHistory';
import SettingsManager from './SettingsManager';

type Tab = 'dashboard' | 'pages' | 'news' | 'calendar' | 'documents' | 'media' | 'navigation' | 'settings' | 'revisions';
const tabs: [Tab, string][] = [['dashboard', 'Översikt'], ['pages', 'Sidor'], ['news', 'Nyheter'], ['calendar', 'Kalender'], ['documents', 'Dokument'], ['media', 'Media'], ['navigation', 'Navigation'], ['settings', 'Inställningar'], ['revisions', 'Historik']];

function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState(''); const [recovery, setRecovery] = useState(false);
  const submit = async (event: SyntheticEvent<HTMLFormElement>) => { event.preventDefault(); setMessage(''); if (recovery) { const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/admin/` }); setMessage(error ? 'Återställningslänken kunde inte skickas.' : 'Kontrollera din e-post.'); } else { const { error } = await client.auth.signInWithPassword({ email, password }); if (error) setMessage('E-post eller lösenord är fel.'); } };
  return <main className="admin-login"><form onSubmit={submit}><p className="eyebrow">Smedby 1:6</p><h1>{recovery ? 'Återställ lösenord' : 'Administration'}</h1><label>E-post<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{!recovery && <label>Lösenord<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}<button className="button button-primary" type="submit">{recovery ? 'Skicka återställningslänk' : 'Logga in'}</button><button className="text-button" type="button" onClick={() => setRecovery(!recovery)}>{recovery ? 'Till inloggningen' : 'Glömt lösenordet?'}</button>{message && <p role="status">{message}</p>}</form></main>;
}

function RecoveryPassword({ client, onDone }: { client: SupabaseClient; onDone: () => void }) {
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [message, setMessage] = useState('');
  const submit = async (event: SyntheticEvent<HTMLFormElement>) => { event.preventDefault(); if (password.length < 12) { setMessage('Lösenordet måste innehålla minst 12 tecken.'); return; } if (password !== confirmation) { setMessage('Lösenorden är inte lika.'); return; } const { error } = await client.auth.updateUser({ password }); if (error) { setMessage('Lösenordet kunde inte uppdateras.'); return; } setMessage('Lösenordet är uppdaterat.'); onDone(); };
  return <main className="admin-login"><form onSubmit={submit}><h1>Välj nytt lösenord</h1><label>Nytt lösenord<input type="password" minLength={12} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Upprepa lösenord<input type="password" minLength={12} required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className="button button-primary">Spara lösenord</button>{message && <p role="status">{message}</p>}</form></main>;
}

function Shell({ client, session }: { client: SupabaseClient; session: Session }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  return <div className="admin-shell"><header><a href="/">Smedby 1:6</a><span>{session.user.email}</span><button onClick={() => client.auth.signOut()}>Logga ut</button></header><nav aria-label="Administration">{tabs.map(([key, label]) => <button className={tab === key ? 'is-active' : ''} key={key} onClick={() => setTab(key)}>{label}</button>)}</nav><main>{tab === 'dashboard' && <DeploymentDashboard client={client} />}{tab === 'pages' && <PagesManager client={client} />}{tab === 'news' && <ResourceEditor client={client} kind="news_posts" />}{tab === 'calendar' && <ResourceEditor client={client} kind="calendar_events" />}{tab === 'documents' && <ResourceEditor client={client} kind="documents" />}{tab === 'media' && <MediaManager client={client} />}{tab === 'navigation' && <NavigationManager client={client} />}{tab === 'settings' && <SettingsManager client={client} />}{tab === 'revisions' && <RevisionHistory client={client} />}</main></div>;
}

export default function AdminApp() {
  const client = getSupabaseBrowserClient(); const [session, setSession] = useState<Session | null>(null); const [ready, setReady] = useState(false); const [allowed, setAllowed] = useState<boolean | null>(null); const [recovering, setRecovering] = useState(false);
  useEffect(() => { if (!client) { setReady(true); return; } client.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); }); const { data } = client.auth.onAuthStateChange((event, next) => { setSession(next); if (event === 'PASSWORD_RECOVERY') setRecovering(true); }); return () => data.subscription.unsubscribe(); }, [client]);
  useEffect(() => { if (!client || !session) { setAllowed(null); return; } client.from('admin_profiles').select('active').eq('user_id', session.user.id).maybeSingle().then(({ data }) => setAllowed(Boolean(data?.active))); }, [client, session]);
  if (!client) return <main className="admin-setup"><h1>Adminsystemet behöver anslutas</h1><p>Lägg in <code>PUBLIC_SUPABASE_URL</code> och <code>PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> i en lokal <code>.env</code>-fil. Hemliga nycklar får inte användas här.</p></main>;
  if (!ready) return <p>Laddar…</p>;
  if (!session) return <Login client={client} />;
  if (recovering) return <RecoveryPassword client={client} onDone={() => setRecovering(false)} />;
  if (allowed === null) return <p>Laddar behörighet…</p>;
  if (!allowed) return <main className="admin-setup"><h1>Åtkomst saknas</h1><p>Kontot är inloggat men är inte en aktiv administratör.</p><button onClick={() => client.auth.signOut()}>Logga ut</button></main>;
  return <Shell client={client} session={session} />;
}
