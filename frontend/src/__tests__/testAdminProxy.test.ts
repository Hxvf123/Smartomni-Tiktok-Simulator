import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../../api/test-admin';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('TEST_ADMIN_TOKEN', 'secret-token');
  vi.stubEnv('API_ORIGIN', 'https://api.example.test/');
  fetchMock.mockResolvedValue(
    new Response('{"ok":true}', { status: 201, headers: { 'content-type': 'application/json', 'x-request-id': 'req-1', 'set-cookie': 'a=b' } }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

describe('test-admin Vercel Function', () => {
  it('forwards method, path, query and body with the admin token', async () => {
    const res = await handler(
      new Request('https://shop.example.test/api/test-admin?__path=orders/42/transition&shopId=7', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"to":"SHIPPED"}',
      }),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.example.test/test-admin/orders/42/transition?shopId=7');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'x-test-admin-token': 'secret-token', 'content-type': 'application/json' });
    expect(new TextDecoder().decode(init.body)).toBe('{"to":"SHIPPED"}');

    expect(res.status).toBe(201);
    expect(await res.text()).toBe('{"ok":true}');
    expect(res.headers.get('x-request-id')).toBe('req-1');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('sends no body for GET and defaults to the Render API', async () => {
    vi.stubEnv('API_ORIGIN', '');
    await handler(new Request('https://shop.example.test/api/test-admin?__path=clock'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://smartomni-tiktok-simulator-api.onrender.com/test-admin/clock');
    expect(init.body).toBeUndefined();
  });

  it('fails clearly when the token is missing and never calls the API', async () => {
    vi.stubEnv('TEST_ADMIN_TOKEN', '');
    const res = await handler(new Request('https://shop.example.test/api/test-admin?__path=seed', { method: 'POST' }));
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses paths that leave /test-admin', async () => {
    const res = await handler(new Request('https://shop.example.test/api/test-admin?__path=../demo/x'));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
