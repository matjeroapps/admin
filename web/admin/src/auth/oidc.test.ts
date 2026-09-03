import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from 'oidc-client-ts';
import { createOidcAuthClient, createOidcUserManagerSettings, sanitizeReturnPath, checkDevAuthEnabled, type UserManagerLike } from './oidc';

function mockUser(overrides?: Partial<User>): User {
  return {
    id_token: 'id-token-123',
    access_token: 'access-token-123',
    refresh_token: 'refresh-token-123',
    token_type: 'Bearer',
    scope: 'openid profile email',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expired: false,
    state: undefined,
    profile: {
      sub: 'usr_admin_1',
      preferred_username: 'admin_user',
      email: 'admin@example.com',
      roles: ['platform_admin'],
      aud: 'admin-app',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      iss: 'https://auth.example.com'
    },
    toStorageString: () => '',
    ...overrides
  } as User;
}

type MockUserManager = UserManagerLike & {
  userLoadedCb?: (u: User) => void;
  userUnloadedCb?: () => void;
  tokenExpiringCb?: () => void;
  tokenExpiredCb?: () => void;
  setCurrentUser: (u: User | null) => void;
};

function mockUserManager(): MockUserManager {
  let currentUser: User | null = null;
  const mgr: MockUserManager = {
    getUser: vi.fn(async () => currentUser),
    signinRedirect: vi.fn(async () => {}),
    signinRedirectCallback: vi.fn(async () => {
      currentUser = mockUser({ state: { returnPath: '/dashboard' } });
      return currentUser;
    }),
    signinSilent: vi.fn(async () => {
      currentUser = mockUser({ access_token: 'renewed-access-token' });
      return currentUser;
    }),
    signoutRedirect: vi.fn(async () => {
      currentUser = null;
    }),
    removeUser: vi.fn(async () => {
      currentUser = null;
    }),
    events: {
      addUserLoaded: (cb: (u: User) => void) => {
        mgr.userLoadedCb = cb;
      },
      addUserUnloaded: (cb: () => void) => {
        mgr.userUnloadedCb = cb;
      },
      addAccessTokenExpiring: (cb: () => void) => {
        mgr.tokenExpiringCb = cb;
      },
      addAccessTokenExpired: (cb: () => void) => {
        mgr.tokenExpiredCb = cb;
      }
    },
    setCurrentUser: (u: User | null) => {
      currentUser = u;
    }
  };
  return mgr;
}

describe('createOidcUserManagerSettings', () => {
  it('disables automaticSilentRenew to enforce Matjero AuthClient as single renewal authority', () => {
    const settings = createOidcUserManagerSettings('https://auth.example.com', 'admin-client', 'https://admin.example.com/auth/callback', 'https://admin.example.com');
    expect(settings.automaticSilentRenew).toBe(false);
    expect(settings.authority).toBe('https://auth.example.com');
    expect(settings.client_id).toBe('admin-client');
  });
});

describe('checkDevAuthEnabled matrix', () => {
  it('activates ONLY when DEV=true AND VITE_ADMIN_DEV_AUTH="true"', () => {
    expect(checkDevAuthEnabled(false, 'true')).toBe(false);
    expect(checkDevAuthEnabled(true, undefined)).toBe(false);
    expect(checkDevAuthEnabled(true, 'false')).toBe(false);
    expect(checkDevAuthEnabled(true, 'random')).toBe(false);
    expect(checkDevAuthEnabled(true, 'true')).toBe(true);
  });
});

describe('sanitizeReturnPath', () => {
  it('returns valid internal absolute path', () => {
    expect(sanitizeReturnPath('/suppliers')).toBe('/suppliers');
    expect(sanitizeReturnPath('/sellers/123')).toBe('/sellers/123');
  });

  it('sanitizes empty, invalid, or external targets to root /', () => {
    expect(sanitizeReturnPath('')).toBe('/');
    expect(sanitizeReturnPath(undefined)).toBe('/');
    expect(sanitizeReturnPath('https://attacker.com')).toBe('/');
    expect(sanitizeReturnPath('//attacker.com')).toBe('/');
    expect(sanitizeReturnPath('/\\attacker.com')).toBe('/');
  });
});

describe('createOidcAuthClient', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('restores authenticated state when userManager has valid user', async () => {
    const um = mockUserManager();
    const validUser = mockUser();
    um.setCurrentUser(validUser);

    const client = createOidcAuthClient({ userManager: um });
    await Promise.resolve();

    expect(client.getState().isAuthenticated).toBe(true);
    expect(client.getState().user?.subject).toBe('usr_admin_1');
    expect(await client.getAccessToken()).toBe('access-token-123');
  });

  it('handles initialization rejection by entering Authentication Error state with sanitized error message', async () => {
    const um = mockUserManager();
    um.getUser = vi.fn(async () => {
      throw new Error('Raw storage failure exception');
    });

    const client = createOidcAuthClient({ userManager: um });
    await new Promise<void>((r) => queueMicrotask(() => r()));

    expect(client.getState().isAuthenticated).toBe(false);
    expect(client.getState().user).toBeNull();
    expect(client.getState().isLoading).toBe(false);
    expect(client.getState().error).toBe('Authentication initialization failed');
  });

  it('handles login initiation with returnPath', async () => {
    const um = mockUserManager();
    const client = createOidcAuthClient({ userManager: um });

    await client.login('/sellers');
    expect(um.signinRedirect).toHaveBeenCalledWith({
      state: { returnPath: '/sellers' }
    });
  });

  it('handles callback processing and return path extraction', async () => {
    const um = mockUserManager();
    const client = createOidcAuthClient({ userManager: um });

    const returnPath = await client.handleCallback('https://admin.example.com/auth/callback?code=CODE&state=STATE');
    expect(returnPath).toBe('/dashboard');
    expect(client.getState().isAuthenticated).toBe(true);
    expect(client.getState().user?.subject).toBe('usr_admin_1');
  });

  it('handles callback rejection by setting sanitized error message', async () => {
    const um = mockUserManager();
    um.signinRedirectCallback = vi.fn(async () => {
      throw new Error('Invalid grant code raw error');
    });

    const client = createOidcAuthClient({ userManager: um });
    await expect(client.handleCallback('https://admin.example.com/auth/callback?error=invalid_grant')).rejects.toThrow('Authentication callback failed');

    expect(client.getState().isAuthenticated).toBe(false);
    expect(client.getState().error).toBe('Authentication callback failed');
  });

  it('handles logout and user session clearance to unauthenticated state with null error', async () => {
    const um = mockUserManager();
    um.setCurrentUser(mockUser());
    const client = createOidcAuthClient({ userManager: um });
    await Promise.resolve();

    await client.logout();
    expect(um.signoutRedirect).toHaveBeenCalled();
    expect(client.getState().isAuthenticated).toBe(false);
    expect(client.getState().error).toBeNull();
  });

  it('coordinates concurrent renewal calls via single-flight mechanism', async () => {
    let resolveBarrier!: (u: User) => void;
    const pendingPromise = new Promise<User>((resolve) => {
      resolveBarrier = resolve;
    });

    const um = mockUserManager();
    um.signinSilent = vi.fn(async () => pendingPromise);

    const client = createOidcAuthClient({ userManager: um });

    // Call renewToken 10 times concurrently while signinSilent is pending
    const concurrentRenewals = Array.from({ length: 10 }, () => client.renewToken());

    expect(um.signinSilent).toHaveBeenCalledTimes(1);

    // Resolve the single signinSilent call
    const renewedUser = mockUser({ access_token: 'single-flight-token' });
    resolveBarrier(renewedUser);

    const results = await Promise.all(concurrentRenewals);
    expect(results).toEqual(Array(10).fill('single-flight-token'));

    // Verify a new renewal CAN be started AFTER completion
    const nextToken = await client.renewToken();
    expect(um.signinSilent).toHaveBeenCalledTimes(2);
    expect(nextToken).toBe('single-flight-token');
  });

  it('deduplicates simultaneous token event and API renewal calls into single signinSilent execution', async () => {
    let resolveBarrier!: (u: User) => void;
    const pendingPromise = new Promise<User>((resolve) => {
      resolveBarrier = resolve;
    });

    const um = mockUserManager();
    um.setCurrentUser(mockUser({ expired: true }));
    um.signinSilent = vi.fn(async () => pendingPromise);

    const client = createOidcAuthClient({ userManager: um });
    await Promise.resolve();

    // Trigger token expiring event AND concurrent getAccessToken API call
    um.tokenExpiringCb?.();
    const tokenPromise = client.getAccessToken();
    const renewPromise = client.renewToken();

    expect(um.signinSilent).toHaveBeenCalledTimes(1);

    resolveBarrier(mockUser({ access_token: 'event-shared-token' }));

    const [t1, t2] = await Promise.all([tokenPromise, renewPromise]);
    expect(t1).toBe('event-shared-token');
    expect(t2).toBe('event-shared-token');
  });

  it('getAccessToken reuses single-flight renewToken path when user is expired', async () => {
    const um = mockUserManager();
    const expiredUser = mockUser({ expired: true });
    um.setCurrentUser(expiredUser);

    const client = createOidcAuthClient({ userManager: um });
    await Promise.resolve();

    const renewedToken = await client.getAccessToken();
    expect(renewedToken).toBe('renewed-access-token');
    expect(um.signinSilent).toHaveBeenCalledTimes(1);
  });

  it('fails closed when missing production OIDC configuration', async () => {
    const originalIssuer = import.meta.env.VITE_ZITADEL_ISSUER;
    const originalClientId = import.meta.env.VITE_ZITADEL_CLIENT_ID;
    delete (import.meta.env as any).VITE_ZITADEL_ISSUER;
    delete (import.meta.env as any).VITE_ZITADEL_CLIENT_ID;
    delete (import.meta.env as any).VITE_ADMIN_DEV_AUTH;

    const client = createOidcAuthClient();
    expect(client.getState().isAuthenticated).toBe(false);
    expect(client.getState().error).toContain('Authentication configuration missing');
    expect(await client.getAccessToken()).toBeNull();

    (import.meta.env as any).VITE_ZITADEL_ISSUER = originalIssuer;
    (import.meta.env as any).VITE_ZITADEL_CLIENT_ID = originalClientId;
  });
});
