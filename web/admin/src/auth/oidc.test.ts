import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from 'oidc-client-ts';
import { createOidcAuthClient, sanitizeReturnPath, type UserManagerLike } from './oidc';

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
    await new Promise((r) => setTimeout(r, 10));

    expect(client.getState().isAuthenticated).toBe(true);
    expect(client.getState().user?.subject).toBe('usr_admin_1');
    expect(await client.getAccessToken()).toBe('access-token-123');
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

  it('handles logout and user session clearance', async () => {
    const um = mockUserManager();
    um.setCurrentUser(mockUser());
    const client = createOidcAuthClient({ userManager: um });
    await new Promise((r) => setTimeout(r, 10));

    await client.logout();
    expect(um.signoutRedirect).toHaveBeenCalled();
    expect(client.getState().isAuthenticated).toBe(false);
  });

  it('renews expired token via signinSilent', async () => {
    const um = mockUserManager();
    const expiredUser = mockUser({ expired: true });
    um.setCurrentUser(expiredUser);

    const client = createOidcAuthClient({ userManager: um });
    await new Promise((r) => setTimeout(r, 10));

    const renewedToken = await client.getAccessToken();
    expect(renewedToken).toBe('renewed-access-token');
    expect(client.getState().isAuthenticated).toBe(true);
  });

  it('handles token expiration event', async () => {
    const um = mockUserManager();
    um.setCurrentUser(mockUser());
    const client = createOidcAuthClient({ userManager: um });
    await new Promise((r) => setTimeout(r, 10));

    um.tokenExpiredCb?.();
    expect(client.getState().isAuthenticated).toBe(false);
    expect(client.getState().error).toBe('Session expired');
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
