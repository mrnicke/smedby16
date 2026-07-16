import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('Deno', { env: { get: (name: string) => name === 'PUBLIC_SITE_URL' ? 'https://www.smedby1-6.se' : undefined } });
});

describe('Edge Function CORS boundary', () => {
  it('rejects preflight requests from unknown origins before function work starts', async () => {
    const { preflightResponse } = await import('../../../supabase/functions/_shared/cors');
    const response = preflightResponse(new Request('http://local.test', {
      method: 'OPTIONS',
      headers: { origin: 'https://attacker.invalid', 'access-control-request-method': 'GET' },
    }), ['GET']);

    expect(response?.status).toBe(403);
    expect(response?.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('allows the configured site and exact localhost development origins', async () => {
    const { preflightResponse } = await import('../../../supabase/functions/_shared/cors');
    const response = preflightResponse(new Request('http://local.test', {
      method: 'OPTIONS', headers: { origin: 'https://www.smedby1-6.se' },
    }), ['POST']);

    expect(response?.status).toBe(204);
    expect(response?.headers.get('access-control-allow-origin')).toBe('https://www.smedby1-6.se');
  });
});
