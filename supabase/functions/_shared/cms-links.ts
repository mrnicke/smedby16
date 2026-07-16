// Canonical CMS link helpers shared by the Astro app and Supabase Edge Functions.
export function resolveCmsHref(href: string, supabaseUrl?: string) {
  if (href === '/kalender.ics' && supabaseUrl) {
    return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/calendar-ics`;
  }
  return href;
}

export function collectInternalHrefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectInternalHrefs);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    if (key === 'href' && typeof child === 'string' && child.startsWith('/') && !child.startsWith('//')) return [child];
    return collectInternalHrefs(child);
  });
}

export function invalidInternalHrefs(value: unknown, allowedPaths: string[]) {
  const allowed = new Set([...allowedPaths, '/kalender.ics']);
  return [...new Set(collectInternalHrefs(value).filter((href) => {
    const path = new URL(href, 'https://smedby.local').pathname;
    return !allowed.has(path);
  }))];
}
