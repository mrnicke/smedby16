import { lazy, Suspense, useEffect, useState, type SyntheticEvent } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import { AdminLoading, AdminNotice } from './AdminFeedback';
import { AdminDirtyProvider, confirmDiscard, useAdminDirtyState } from './useUnsavedChanges';

const DeploymentDashboard=lazy(()=>import('./DeploymentDashboard'));
const MediaManager=lazy(()=>import('./MediaManager'));
const NavigationManager=lazy(()=>import('./NavigationManager'));
const PagesManager=lazy(()=>import('./PagesManager'));
const ResourceEditor=lazy(()=>import('./ResourceEditor'));
const RevisionHistory=lazy(()=>import('./RevisionHistory'));
const SettingsManager=lazy(()=>import('./SettingsManager'));
const EditorLibraryManager=lazy(()=>import('./EnhancedEditorLibraryManager'));

type Tab = 'dashboard' | 'pages' | 'news' | 'calendar' | 'documents' | 'media' | 'navigation' | 'settings' | 'builder' | 'revisions';
type TabItem = { key: Tab; label: string; icon: string; group: 'Innehåll' | 'Webbplats' };
const tabs: TabItem[] = [
  { key: 'dashboard', label: 'Översikt', icon: 'ph-house', group: 'Innehåll' },
  { key: 'pages', label: 'Redigera sidor', icon: 'ph-file-text', group: 'Innehåll' },
  { key: 'news', label: 'Nyheter', icon: 'ph-newspaper', group: 'Innehåll' },
  { key: 'calendar', label: 'Kalender', icon: 'ph-calendar-dots', group: 'Innehåll' },
  { key: 'documents', label: 'Dokument', icon: 'ph-files', group: 'Innehåll' },
  { key: 'media', label: 'Media', icon: 'ph-image', group: 'Webbplats' },
  { key: 'navigation', label: 'Navigation', icon: 'ph-list', group: 'Webbplats' },
  { key: 'settings', label: 'Inställningar', icon: 'ph-gear', group: 'Webbplats' },
  { key: 'builder', label: 'Editorbibliotek', icon: 'ph-layout', group: 'Webbplats' },
  { key: 'revisions', label: 'Historik', icon: 'ph-clock-counter-clockwise', group: 'Webbplats' },
];

function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState(''); const [recovery, setRecovery] = useState(false); const [busy, setBusy] = useState(false); const [showPassword, setShowPassword] = useState(false);
  const submit = async (event: SyntheticEvent<HTMLFormElement>) => { event.preventDefault(); setMessage(''); setBusy(true); if (recovery) { const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/admin/` }); setMessage(error ? 'Återställningslänken kunde inte skickas. Försök igen om en stund.' : 'Klart! Kontrollera din e-post efter återställningslänken.'); } else { const { error } = await client.auth.signInWithPassword({ email, password }); if (error) setMessage('E-postadressen eller lösenordet stämmer inte.'); } setBusy(false); };
  return <main className="admin-login"><form onSubmit={submit}><div className="login-brand"><span className="brand-mark" aria-hidden="true">S</span><div><strong>Smedby 1:6</strong><small>Webbplatsadministration</small></div></div><div><p className="eyebrow">För administratörer</p><h1>{recovery ? 'Återställ lösenord' : 'Välkommen tillbaka'}</h1><p>{recovery ? 'Ange din e-postadress så skickar vi en säker återställningslänk.' : 'Logga in för att uppdatera webbplatsens innehåll.'}</p></div><label>E-postadress<input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{!recovery && <label>Lösenord<span className="password-field"><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? 'Dölj lösenord' : 'Visa lösenord'} onClick={() => setShowPassword(!showPassword)}><i className={`ph ${showPassword ? 'ph-eye-slash' : 'ph-eye'}`} aria-hidden="true" /></button></span></label>}<button className="button button-primary login-submit" type="submit" disabled={busy}>{busy ? 'Arbetar…' : recovery ? 'Skicka återställningslänk' : 'Logga in'}</button><button className="text-button" type="button" onClick={() => { setRecovery(!recovery); setMessage(''); }}>{recovery ? 'Tillbaka till inloggningen' : 'Glömt lösenordet?'}</button><AdminNotice message={message} tone={message.startsWith('Klart') ? 'success' : 'error'} onDismiss={() => setMessage('')} /></form></main>;
}

function RecoveryPassword({ client, onDone }: { client: SupabaseClient; onDone: () => void }) {
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [message, setMessage] = useState('');
  const submit = async (event: SyntheticEvent<HTMLFormElement>) => { event.preventDefault(); if (password.length < 12) { setMessage('Lösenordet måste innehålla minst 12 tecken.'); return; } if (password !== confirmation) { setMessage('Lösenorden är inte lika.'); return; } const { error } = await client.auth.updateUser({ password }); if (error) { setMessage('Lösenordet kunde inte uppdateras.'); return; } setMessage('Lösenordet är uppdaterat.'); onDone(); };
  return <main className="admin-login"><form onSubmit={submit}><h1>Välj nytt lösenord</h1><label>Nytt lösenord<input type="password" minLength={12} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Upprepa lösenord<input type="password" minLength={12} required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className="button button-primary">Spara lösenord</button>{message && <p role="status">{message}</p>}</form></main>;
}

function Shell({ client, session, role }: { client: SupabaseClient; session: Session; role:'editor'|'admin' }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const { dirty } = useAdminDirtyState();
  const active = tabs.find((item) => item.key === tab)!;
  const navigate = (next: Tab) => { if (next === tab) { setMenuOpen(false); return; } if (!confirmDiscard(dirty)) return; setTab(next); setMenuOpen(false); };
  const signOut = () => { if (confirmDiscard(dirty)) void client.auth.signOut(); };
  return <div className="admin-shell">
    <header className="admin-mobile-header"><button className="admin-menu-button" type="button" aria-label={menuOpen ? 'Stäng huvudmenyn' : 'Öppna huvudmenyn'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><i className={`ph ${menuOpen ? 'ph-x' : 'ph-list'}`} aria-hidden="true" /></button><strong>{active.label}</strong><a href="/" target="_blank" rel="noreferrer" aria-label="Visa webbplatsen i ny flik"><i className="ph ph-arrow-square-out" aria-hidden="true" /></a></header>
    <aside className={menuOpen ? 'admin-sidebar is-open' : 'admin-sidebar'}>
      <div className="admin-brand"><span className="brand-mark" aria-hidden="true">S</span><div><strong>Smedby 1:6</strong><small>Administration</small></div></div>
      <nav aria-label="Administration">{(['Innehåll', 'Webbplats'] as const).map((group) => <div className="admin-nav-group" key={group}><span>{group}</span>{tabs.filter((item) => item.group === group && (item.key!=='builder'||import.meta.env.PUBLIC_ADVANCED_EDITOR==='true')).map((item) => <button type="button" className={tab === item.key ? 'is-active' : ''} aria-current={tab === item.key ? 'page' : undefined} key={item.key} onClick={() => navigate(item.key)}><i className={`ph ${item.icon}`} aria-hidden="true" /><span>{item.label}</span></button>)}</div>)}</nav>
      <div className="admin-account"><div><i className="ph ph-user-circle" aria-hidden="true" /><span><strong>Inloggad</strong><small>{session.user.email}</small></span></div><a href="/" target="_blank" rel="noreferrer"><i className="ph ph-arrow-square-out" aria-hidden="true" />Visa webbplatsen</a><button type="button" onClick={signOut}><i className="ph ph-sign-out" aria-hidden="true" />Logga ut</button></div>
    </aside>
    {menuOpen && <button className="admin-sidebar-backdrop" type="button" aria-label="Stäng huvudmenyn" onClick={() => setMenuOpen(false)} />}
    <main id="admin-main"><Suspense fallback={<AdminLoading label="Öppnar verktyget"/>}>{tab === 'dashboard' && <DeploymentDashboard client={client} onNavigate={navigate} />}{tab === 'pages' && <PagesManager client={client} />}{tab === 'news' && <ResourceEditor client={client} kind="news_posts" />}{tab === 'calendar' && <ResourceEditor client={client} kind="calendar_events" />}{tab === 'documents' && <ResourceEditor client={client} kind="documents" />}{tab === 'media' && <MediaManager client={client} />}{tab === 'navigation' && <NavigationManager client={client} />}{tab === 'settings' && <SettingsManager client={client} />}{tab === 'builder' && <EditorLibraryManager client={client} role={role}/>} {tab === 'revisions' && <RevisionHistory client={client} />}</Suspense></main>
  </div>;
}

export default function AdminApp() {
  const client = getSupabaseBrowserClient(); const [session, setSession] = useState<Session | null>(null); const [ready, setReady] = useState(false); const [allowed, setAllowed] = useState<boolean | null>(null); const [recovering, setRecovering] = useState(false);
  const [role,setRole]=useState<'editor'|'admin'>('editor');
  useEffect(() => { if (!client) { setReady(true); return; } client.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); }); const { data } = client.auth.onAuthStateChange((event, next) => { setSession(next); if (event === 'PASSWORD_RECOVERY') setRecovering(true); }); return () => data.subscription.unsubscribe(); }, [client]);
  useEffect(() => { if (!client || !session) { setAllowed(null); return; } client.from('admin_profiles').select('active,role').eq('user_id', session.user.id).maybeSingle().then(({ data }) => {setAllowed(Boolean(data?.active));setRole(data?.role==='admin'?'admin':'editor');}); }, [client, session]);
  if (!client) return <main className="admin-setup"><h1>Adminsystemet behöver anslutas</h1><p>Lägg in <code>PUBLIC_SUPABASE_URL</code> och <code>PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> i en lokal <code>.env</code>-fil. Hemliga nycklar får inte användas här.</p></main>;
  if (!ready) return <AdminLoading label="Startar administrationen" />;
  if (!session) return <Login client={client} />;
  if (recovering) return <RecoveryPassword client={client} onDone={() => setRecovering(false)} />;
  if (allowed === null) return <AdminLoading label="Kontrollerar behörighet" />;
  if (!allowed) return <main className="admin-setup"><h1>Åtkomst saknas</h1><p>Kontot är inloggat men är inte en aktiv administratör.</p><button onClick={() => client.auth.signOut()}>Logga ut</button></main>;
  return <AdminDirtyProvider><Shell client={client} session={session} role={role}/></AdminDirtyProvider>;
}
