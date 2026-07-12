import { describe, expect, it } from 'vitest';
import { isAllowedPublicSupabaseUrl } from './config';

describe('public Supabase URL validation', () => {
  it('accepts hosted Supabase and local loopback development', () => {
    expect(isAllowedPublicSupabaseUrl('https://project.supabase.co')).toBe(true);
    expect(isAllowedPublicSupabaseUrl('http://127.0.0.1:54321')).toBe(true);
    expect(isAllowedPublicSupabaseUrl('http://localhost:54321')).toBe(true);
  });

  it('rejects insecure non-local and lookalike hosts', () => {
    expect(isAllowedPublicSupabaseUrl('http://example.com')).toBe(false);
    expect(isAllowedPublicSupabaseUrl('https://supabase.co.example.com')).toBe(false);
  });
});
