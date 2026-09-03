export type ApiConfig = {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
  renewToken?: () => Promise<string | null>;
  onUnauthorized?: () => void;
  onForbidden?: () => void;
};

export function createApiClient(config: ApiConfig) {
  async function performFetch(path: string, options: RequestInit, tokenOverride?: string | null): Promise<Response> {
    const token = tokenOverride !== undefined ? tokenOverride : await config.getAccessToken?.();
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const url = new URL(path, config.baseUrl);
    return fetch(url, { ...options, headers });
  }

  async function request(method: string, path: string, body?: unknown): Promise<Response> {
    const options: RequestInit = {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body === undefined ? undefined : JSON.stringify(body)
    };

    let response = await performFetch(path, options);

    if (response.status === 401) {
      if (config.renewToken) {
        const newToken = await config.renewToken();
        if (newToken) {
          response = await performFetch(path, options, newToken);
          if (response.status === 401) {
            config.onUnauthorized?.();
          } else if (response.status === 403) {
            config.onForbidden?.();
          }
          return response;
        }
      }
      config.onUnauthorized?.();
      return response;
    }

    if (response.status === 403) {
      config.onForbidden?.();
      return response;
    }

    return response;
  }

  return {
    get(path: string): Promise<Response> {
      return request('GET', path);
    },
    post(path: string, body?: unknown): Promise<Response> {
      return request('POST', path, body);
    },
    put(path: string, body?: unknown): Promise<Response> {
      return request('PUT', path, body);
    }
  };
}
