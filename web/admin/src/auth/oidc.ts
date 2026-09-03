import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

export type AuthUser = {
  subject: string;
  preferred_username?: string;
  email?: string;
  roles?: string[];
};

export type AuthState = {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
};

export interface UserManagerLike {
  getUser(): Promise<User | null>;
  signinRedirect(args?: unknown): Promise<void>;
  signinRedirectCallback(url?: string): Promise<User>;
  signinSilent(args?: unknown): Promise<User | null>;
  signoutRedirect(args?: unknown): Promise<void>;
  removeUser(): Promise<void>;
  events: {
    addUserLoaded(cb: (user: User) => void): void;
    addUserUnloaded(cb: () => void): void;
    addAccessTokenExpiring?(cb: () => void): void;
    addAccessTokenExpired(cb: () => void): void;
  };
}

export interface AuthClient {
  getAccessToken(): Promise<string | null>;
  renewToken(): Promise<string | null>;
  clearSession(options?: { error?: string | null }): Promise<void>;
  login(returnPath?: string): Promise<void>;
  handleCallback(url?: string): Promise<string>;
  logout(): Promise<void>;
  getUser(): AuthUser | null;
  subscribe(listener: (state: AuthState) => void): () => void;
  getState(): AuthState;
}

export function sanitizeReturnPath(path?: string): string {
  if (!path || typeof path !== 'string') return '/';
  if (path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')) {
    return path;
  }
  return '/';
}

export function checkDevAuthEnabled(isDev: boolean, devAuthEnvVal?: string): boolean {
  return Boolean(isDev && devAuthEnvVal === 'true');
}

export function createOidcUserManagerSettings(
  issuer: string,
  clientId: string,
  redirectUri: string,
  postLogoutRedirectUri: string
) {
  return {
    authority: issuer,
    client_id: clientId,
    redirect_uri: redirectUri,
    post_logout_redirect_uri: postLogoutRedirectUri,
    response_type: 'code',
    scope: 'openid profile email offline_access',
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: false
  };
}

export type OidcClientOptions = {
  userManager?: UserManagerLike;
};

export function createOidcAuthClient(options?: OidcClientOptions): AuthClient {
  const issuer = import.meta.env.VITE_ZITADEL_ISSUER;
  const clientId = import.meta.env.VITE_ZITADEL_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_ZITADEL_REDIRECT_URI || `${window.location.origin}/auth/callback`;
  const postLogoutRedirectUri = import.meta.env.VITE_ZITADEL_POST_LOGOUT_REDIRECT_URI || window.location.origin;

  const isDevAuthEnabled = checkDevAuthEnabled(Boolean(import.meta.env.DEV), import.meta.env.VITE_ADMIN_DEV_AUTH);
  const isOidcConfigured = Boolean((issuer && clientId) || options?.userManager);

  const listeners = new Set<(state: AuthState) => void>();

  let currentState: AuthState = {
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null
  };

  function updateState(next: Partial<AuthState>) {
    currentState = { ...currentState, ...next };
    for (const listener of listeners) {
      listener(currentState);
    }
  }

  let userManager: UserManagerLike | null = options?.userManager ?? null;
  let renewalPromise: Promise<string | null> | null = null;

  if (isOidcConfigured) {
    if (!userManager && issuer && clientId) {
      userManager = new UserManager(createOidcUserManagerSettings(issuer, clientId, redirectUri, postLogoutRedirectUri));
    }

    if (userManager) {
      userManager
        .getUser()
        .then((user) => {
          if (user && !user.expired) {
            updateState({
              isAuthenticated: true,
              user: mapUser(user),
              isLoading: false,
              error: null
            });
          } else {
            updateState({ isAuthenticated: false, user: null, isLoading: false, error: null });
          }
        })
        .catch(() => {
          updateState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: 'Authentication initialization failed'
          });
        });

      userManager.events.addUserLoaded((user) => {
        updateState({ isAuthenticated: true, user: mapUser(user), isLoading: false, error: null });
      });

      userManager.events.addUserUnloaded(() => {
        updateState({ isAuthenticated: false, user: null, isLoading: false, error: null });
      });

      userManager.events.addAccessTokenExpiring?.(() => {
        void renewToken();
      });

      userManager.events.addAccessTokenExpired(() => {
        void renewToken();
      });
    }
  } else if (isDevAuthEnabled) {
    const stored = sessionStorage.getItem('matjero_admin_dev_user');
    if (stored) {
      try {
        const u = JSON.parse(stored) as AuthUser;
        currentState = { isAuthenticated: true, user: u, isLoading: false, error: null };
      } catch {
        currentState = { isAuthenticated: false, user: null, isLoading: false, error: null };
      }
    } else {
      currentState = { isAuthenticated: false, user: null, isLoading: false, error: null };
    }
  } else {
    // Production fail-closed behavior when OIDC configuration is missing
    currentState = {
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: 'Authentication configuration missing: VITE_ZITADEL_ISSUER and VITE_ZITADEL_CLIENT_ID required'
    };
  }

  function mapUser(user: User): AuthUser {
    const profile = user.profile;
    return {
      subject: profile.sub,
      preferred_username: (profile.preferred_username as string) || (profile.name as string) || profile.sub,
      email: profile.email as string,
      roles: (profile.roles as string[]) || []
    };
  }

  const clearSession = async (options?: { error?: string | null }): Promise<void> => {
    const errorMsg = options?.error ?? null;
    if (userManager) {
      try {
        await userManager.removeUser();
      } catch {
        // ignore
      }
    } else if (isDevAuthEnabled) {
      sessionStorage.removeItem('matjero_admin_dev_user');
      sessionStorage.removeItem('matjero_admin_dev_token');
    }
    updateState({ isAuthenticated: false, user: null, isLoading: false, error: errorMsg });
  };

  async function performRenewal(): Promise<string | null> {
    if (userManager) {
      try {
        const renewed = await userManager.signinSilent();
        if (renewed && !renewed.expired) {
          updateState({ isAuthenticated: true, user: mapUser(renewed), isLoading: false, error: null });
          return renewed.access_token;
        }
      } catch {
        await clearSession();
        return null;
      }
    }
    if (isDevAuthEnabled) {
      return sessionStorage.getItem('matjero_admin_dev_token') ?? 'dev-access-token';
    }
    await clearSession();
    return null;
  }

  const renewToken = async (): Promise<string | null> => {
    if (renewalPromise) {
      return renewalPromise;
    }
    renewalPromise = (async () => {
      try {
        return await performRenewal();
      } finally {
        renewalPromise = null;
      }
    })();
    return renewalPromise;
  };

  return {
    async getAccessToken(): Promise<string | null> {
      if (userManager) {
        const user = await userManager.getUser();
        if (user && !user.expired) {
          return user.access_token;
        }
        if (user && user.expired) {
          return renewToken();
        }
        return null;
      }
      if (isDevAuthEnabled) {
        const devToken = sessionStorage.getItem('matjero_admin_dev_token');
        return devToken ?? (currentState.isAuthenticated ? 'dev-access-token' : null);
      }
      return null;
    },

    renewToken,
    clearSession,

    async login(returnPath?: string): Promise<void> {
      const safePath = sanitizeReturnPath(returnPath);
      if (userManager) {
        await userManager.signinRedirect({ state: { returnPath: safePath } });
      } else if (isDevAuthEnabled) {
        const devUser: AuthUser = {
          subject: 'usr_admin_dev',
          preferred_username: 'admin_dev',
          email: 'admin@example.com',
          roles: ['platform_admin']
        };
        sessionStorage.setItem('matjero_admin_dev_user', JSON.stringify(devUser));
        sessionStorage.setItem('matjero_admin_dev_token', 'dev-access-token');
        updateState({ isAuthenticated: true, user: devUser, isLoading: false, error: null });
        window.location.hash = safePath;
      } else {
        updateState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: 'Authentication configuration missing: VITE_ZITADEL_ISSUER and VITE_ZITADEL_CLIENT_ID required'
        });
      }
    },

    async handleCallback(url?: string): Promise<string> {
      const callbackUrl = url || window.location.href;
      if (userManager) {
        try {
          const user = await userManager.signinRedirectCallback(callbackUrl);
          updateState({ isAuthenticated: true, user: mapUser(user), isLoading: false, error: null });
          const stateObj = user.state as { returnPath?: string } | undefined;
          return sanitizeReturnPath(stateObj?.returnPath);
        } catch {
          updateState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: 'Authentication callback failed'
          });
          throw new Error('Authentication callback failed');
        }
      }
      if (isDevAuthEnabled) {
        return '/';
      }
      throw new Error('Authentication configuration missing');
    },

    async logout(): Promise<void> {
      if (userManager) {
        try {
          await userManager.signoutRedirect();
        } finally {
          await clearSession();
        }
      } else {
        await clearSession();
      }
    },

    getUser(): AuthUser | null {
      return currentState.user;
    },

    getState(): AuthState {
      return currentState;
    },

    subscribe(listener: (state: AuthState) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
