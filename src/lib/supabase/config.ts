export type PublicSupabaseConfig = { url: string; publishableKey: string };

export function isAllowedPublicSupabaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    const hosted = parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
    const local = parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname);
    return hosted || local;
  } catch {
    return false;
  }
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey || url.includes('your-project') || publishableKey.includes('replace_me')) return null;
  if (!isAllowedPublicSupabaseUrl(url)) return null;
  return { url: url.replace(/\/$/, ''), publishableKey };
}
