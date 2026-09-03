import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createStaticServer } from '../server.js';

describe('Admin Static Server Callback Routing Smoke', () => {
  let tmpDir: string;
  let server: http.Server;
  let serverUrl: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-server-test-'));
    fs.writeFileSync(path.join(tmpDir, 'index.html'), '<!DOCTYPE html><html><body>Admin App</body></html>');
    fs.mkdirSync(path.join(tmpDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'assets', 'app.js'), 'console.log("admin app");');

    server = createStaticServer(tmpDir);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as { port: number };
    serverUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('serves index.html on root GET /', async () => {
    const res = await fetch(`${serverUrl}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Admin App');
  });

  it('serves index.html on SPA fallback route /auth/callback?code=TEST&state=TEST', async () => {
    const res = await fetch(`${serverUrl}/auth/callback?code=TEST&state=TEST`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Admin App');
  });

  it('serves real assets directly', async () => {
    const res = await fetch(`${serverUrl}/assets/app.js`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('admin app');
  });

  it('does NOT swallow /v1/* or /api/* API routes into index.html', async () => {
    const resV1 = await fetch(`${serverUrl}/v1/admin/overview`);
    expect(resV1.status).toBe(404);
    const jsonV1 = await resV1.json();
    expect(jsonV1.error.code).toBe('not_found');

    const resApi = await fetch(`${serverUrl}/api/test`);
    expect(resApi.status).toBe(404);
    const jsonApi = await resApi.json();
    expect(jsonApi.error.code).toBe('not_found');

    console.log('ADMIN CALLBACK STATIC ROUTING SMOKE: PASS');
  });
});
