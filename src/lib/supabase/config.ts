export type PublicSupabaseConfig = { url: string; publishableKey: string };

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey || url.includes('your-project') || publishableKey.includes('replace_me')) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) return null;
  } catch {
    return null;
  }
  return { url: url.replace(/\/$/, ''), publishableKey };
}
