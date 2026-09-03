import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { App } from './main';
import type { AuthClient, AuthState } from './auth/oidc';

function mockAuthClient(initialState: AuthState): AuthClient & { listeners: Set<(s: AuthState) => void> } {
  let state = { ...initialState };
  const listeners = new Set<(s: AuthState) => void>();

  return {
    getState: () => state,
    subscribe: (listener: (s: AuthState) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    handleCallback: vi.fn(async () => '/dashboard'),
    getAccessToken: vi.fn(async () => (state.isAuthenticated ? 'test-token' : null)),
    renewToken: vi.fn(async () => (state.isAuthenticated ? 'test-token' : null)),
    clearSession: vi.fn(async (options?: { error?: string | null }) => {
      state = { isAuthenticated: false, user: null, isLoading: false, error: options?.error ?? null };
      for (const l of listeners) l(state);
    }),
    getUser: () => state.user,
    listeners
  };
}

describe('App Top-Level Authentication States & Callback Handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Authentication Error state when initialization fails and makes no business API calls', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const authClient = mockAuthClient({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: 'Authentication initialization failed'
    });

    render(<App authClient={authClient} />);

    expect(screen.getByTestId('auth-error')).toBeDefined();
    expect(screen.getByText('Authentication initialization failed')).toBeDefined();
    expect(screen.getByText('Try Again')).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles realistic OAuth callback processing and scrubs URL parameters', async () => {
    const originalLocation = window.location.href;
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    // Simulate browser landing on callback URL
    delete (window as any).location;
    window.location = new URL('https://admin.example.com/auth/callback?code=CODE123&state=STATE456') as any;

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const authClient = mockAuthClient({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null
    });

    render(<App authClient={authClient} />);

    await waitFor(() => {
      expect(authClient.handleCallback).toHaveBeenCalledWith('https://admin.example.com/auth/callback?code=CODE123&state=STATE456');
    });

    expect(replaceStateSpy).toHaveBeenCalledWith({}, expect.any(String), '/dashboard');

    window.location = new URL(originalLocation) as any;
  });

  it('renders auth loading state', () => {
    const authClient = mockAuthClient({
      isAuthenticated: false,
      user: null,
      isLoading: true,
      error: null
    });

    render(<App authClient={authClient} />);
    expect(screen.getByTestId('auth-loading')).toBeDefined();
  });

  it('renders unauthenticated state with Sign in button and makes no business API calls', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const authClient = mockAuthClient({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null
    });

    render(<App authClient={authClient} />);
    expect(screen.getByTestId('unauthenticated-state')).toBeDefined();
    expect(screen.getByText('Sign in')).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Sign in'));
    expect(authClient.login).toHaveBeenCalledTimes(1);
  });

  it('renders configuration error state when production OIDC config is missing', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const authClient = mockAuthClient({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: 'Authentication configuration missing: VITE_ZITADEL_ISSUER and VITE_ZITADEL_CLIENT_ID required'
    });

    render(<App authClient={authClient} />);
    expect(screen.getByTestId('config-error')).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Sign in')).toBeNull();
  });

  it('renders forbidden state when 403 occurs', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const authClient = mockAuthClient({
      isAuthenticated: true,
      user: { subject: 'usr_2', roles: [] },
      isLoading: false,
      error: null
    });

    render(<App authClient={authClient} />);
    await waitFor(() => {
      expect(screen.getByTestId('forbidden-state')).toBeDefined();
    });
  });

  it('renders dashboard when authenticated', async () => {
    const fetchMock = vi.fn(async (url: URL | string | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/bootstrap')) {
        return new Response(JSON.stringify({ app: 'admin', actor: 'admin', locale: 'en', direction: 'ltr', markets: [] }), { status: 200 });
      }
      if (urlStr.includes('/v1/admin/overview')) {
        return new Response(JSON.stringify({ counts: { suppliers: 3, sellers: 2 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const authClient = mockAuthClient({
      isAuthenticated: true,
      user: { subject: 'usr_admin', preferred_username: 'admin_user', roles: ['platform_admin'] },
      isLoading: false,
      error: null
    });

    render(<App authClient={authClient} />);
    await waitFor(() => {
      expect(screen.getByTestId('authenticated-dashboard')).toBeDefined();
    });
    expect(fetchMock).toHaveBeenCalled();
  });
});
