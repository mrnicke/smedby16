import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminApp from './AdminApp';

const mocks = vi.hoisted(() => ({ client: null as any }));

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => mocks.client,
}));

describe('first administrator bootstrap', () => {
  beforeEach(() => {
    const profileQuery: any = {};
    profileQuery.select = vi.fn(() => profileQuery);
    profileQuery.eq = vi.fn(() => profileQuery);
    profileQuery.maybeSingle = vi.fn(async () => ({ data: null, error: null }));

    mocks.client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: '11111111-1111-4111-8111-111111111111' } } } })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signOut: vi.fn(),
        refreshSession: vi.fn(async () => ({})),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: 'aal1' } })),
          listFactors: vi.fn(async () => ({ data: { totp: [{ id: 'factor-1', status: 'verified' }] } })),
          challenge: vi.fn(async () => ({ data: { id: 'challenge-1' }, error: null })),
          verify: vi.fn(async () => ({ data: {}, error: null })),
        },
      },
      from: vi.fn(() => profileQuery),
      rpc: vi.fn(async (name: string) => name === 'first_admin_claim_available'
        ? { data: true, error: null }
        : { data: null, error: null }),
    };
  });

  it('lets a profile-less invited user complete MFA before claiming the first admin profile', async () => {
    render(<AdminApp />);

    expect(await screen.findByRole('heading', { name: 'Tvåfaktorsautentisering' })).toBeTruthy();
    const verifyButton = await screen.findByRole('button', { name: 'Verifiera och fortsätt' });
    fireEvent.change(screen.getByLabelText('Engångskod'), { target: { value: '123456' } });
    fireEvent.click(verifyButton);

    expect(await screen.findByRole('heading', { name: 'Aktivera första administratören' })).toBeTruthy();
  });
});
