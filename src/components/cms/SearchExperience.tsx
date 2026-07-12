import { useEffect, useState, type SyntheticEvent } from 'react';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';

type SearchResult = { title: string; href: string; type: string; excerpt: string };
const typeLabels: Record<string, string> = { information: 'Information', nyheter: 'Nyhet', dokument: 'Dokument', kalender: 'Kalender' };

export default function SearchExperience({ heading, text, preview = false }: { heading: string; text: string; preview?: boolean }) {
  const initial = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('q') ?? '';
  const initialType = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('type') ?? '';
  const [query, setQuery] = useState(initial);
  const [type, setType] = useState(initialType);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState(initial ? 'Söker…' : 'Skriv minst två tecken för att söka.');

  const search = async (event?: SyntheticEvent) => {
    event?.preventDefault();
    if (preview) { setStatus('Sökningen är avstängd i förhandsvisningen.'); return; }
    if (query.trim().length < 2) { setResults([]); setStatus('Skriv minst två tecken för att söka.'); return; }
    const params = new URLSearchParams(); params.set('q', query.trim()); if (type) params.set('type', type);
    if (location.pathname !== '/sok/') { location.assign(`/sok/?${params.toString()}`); return; }
    const client = getSupabaseBrowserClient();
    if (!client) { setStatus('Sökningen är tillfälligt otillgänglig.'); return; }
    setStatus('Söker…');
    const { data, error } = await client.rpc('search_public_content', { search_query: query.trim(), content_type: type || null, result_limit: 30, result_offset: 0 });
    if (error) { setResults([]); setStatus('Sökningen kunde inte genomföras. Försök igen om en stund.'); return; }
    const next = (data ?? []) as SearchResult[];
    setResults(next); setStatus(next.length === 0 ? 'Inga träffar. Prova ett annat ord.' : `${next.length} träff${next.length === 1 ? '' : 'ar'}.`);
    history.replaceState({}, '', `/sok/?${params.toString()}`);
  };

  useEffect(() => { if (initial.length >= 2 && !preview) void search(); }, []);

  return <section className="cms-section cms-search"><div className="container">
    <div className="cms-search-intro"><h2>{heading}</h2><p>{text}</p></div>
    <form className="cms-search-form" role="search" onSubmit={search}>
      <label>Sökord<input type="search" minLength={2} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Exempel: parkering" /></label>
      <label>Typ<select value={type} onChange={(event) => setType(event.target.value)}><option value="">Allt innehåll</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="submit" className="button button-primary">Sök</button>
    </form>
    <p className="cms-search-status" role="status">{status}</p>
    {results.length > 0 && <ol className="cms-search-results">{results.map((result) => <li key={`${result.type}-${result.href}-${result.title}`}><p className="meta">{typeLabels[result.type] ?? result.type}</p><h3><a href={result.href}>{result.title}</a></h3>{result.excerpt && <p>{result.excerpt}</p>}</li>)}</ol>}
  </div></section>;
}
