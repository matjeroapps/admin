import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiClient } from './api';

describe('createApiClient 401 and 403 retry handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retries request once when 401 occurs and renewToken succeeds', async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async (url: URL | string | Request, init?: RequestInit) => {
      callCount++;
      const headers = new Headers(init?.headers);
      const authHeader = headers.get('Authorization');

      if (callCount === 1) {
        expect(authHeader).toBe('Bearer expired-token');
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
      }
      expect(authHeader).toBe('Bearer renewed-token');
      return new Response(JSON.stringify({ counts: { suppliers: 5 } }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const getAccessToken = vi.fn(async () => 'expired-token');
    const renewToken = vi.fn(async () => 'renewed-token');
    const onUnauthorized = vi.fn();
    const onForbidden = vi.fn();

    const api = createApiClient({
      baseUrl: 'http://admin.example.com',
      getAccessToken,
      renewToken,
      onUnauthorized,
      onForbidden
    });

    const res = await api.get('/v1/admin/overview');
    expect(res.status).toBe(200);
    expect(callCount).toBe(2);
    expect(renewToken).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(onForbidden).not.toHaveBeenCalled();
  });

  it('clears session when retry produces 401 again', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const getAccessToken = vi.fn(async () => 'token-1');
    const renewToken = vi.fn(async () => 'token-2');
    const onUnauthorized = vi.fn();
    const onForbidden = vi.fn();

    const api = createApiClient({
      baseUrl: 'http://admin.example.com',
      getAccessToken,
      renewToken,
      onUnauthorized,
      onForbidden
    });

    const res = await api.get('/v1/admin/overview');
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
    expect(renewToken).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onForbidden).not.toHaveBeenCalled();
  });

  it('invokes onForbidden and preserves session when retry produces 403', async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
      }
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const getAccessToken = vi.fn(async () => 'token-1');
    const renewToken = vi.fn(async () => 'token-2');
    const onUnauthorized = vi.fn();
    const onForbidden = vi.fn();

    const api = createApiClient({
      baseUrl: 'http://admin.example.com',
      getAccessToken,
      renewToken,
      onUnauthorized,
      onForbidden
    });

    const res = await api.get('/v1/admin/overview');
    expect(res.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(renewToken).toHaveBeenCalledTimes(1);
    expect(onForbidden).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('invokes onForbidden directly when initial response is 403', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const getAccessToken = vi.fn(async () => 'valid-user-token-without-role');
    const renewToken = vi.fn();
    const onUnauthorized = vi.fn();
    const onForbidden = vi.fn();

    const api = createApiClient({
      baseUrl: 'http://admin.example.com',
      getAccessToken,
      renewToken,
      onUnauthorized,
      onForbidden
    });

    const res = await api.get('/v1/admin/overview');
    expect(res.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(renewToken).not.toHaveBeenCalled();
    expect(onForbidden).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
