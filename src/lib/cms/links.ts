export function resolveCmsHref(href: string, supabaseUrl?: string) {
  if (href === '/kalender.ics' && supabaseUrl) {
    return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/calendar-ics`;
  }
  return href;
}
