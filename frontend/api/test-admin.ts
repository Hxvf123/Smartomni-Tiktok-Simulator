/*
 * Vercel Function behind the /test-admin/* rewrite (vercel.json). It does what nginx does in Docker:
 * forwards the request to the API and adds the test-admin token server side, so the token never ships
 * in the browser bundle. Env: TEST_ADMIN_TOKEN (required), API_ORIGIN (optional).
 */

const DEFAULT_API_ORIGIN = 'https://smartomni-tiktok-simulator-api.onrender.com';

/** Query parameter that vercel.json uses to pass the path after /test-admin/. */
export const PATH_PARAM = '__path';

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: { 'content-type': 'application/json' } });

export async function handler(request: Request): Promise<Response> {
  const token = process.env.TEST_ADMIN_TOKEN;
  if (!token) return json(500, 'TEST_ADMIN_TOKEN is not set on the Vercel project');

  const incoming = new URL(request.url);
  const path = incoming.searchParams.get(PATH_PARAM) ?? '';
  incoming.searchParams.delete(PATH_PARAM);
  const origin = (process.env.API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/+$/, '');
  const target = new URL(`/test-admin/${path}`, origin);
  // "../" in the path must not take the admin token outside /test-admin.
  if (!target.pathname.startsWith('/test-admin/')) return json(400, 'Invalid test-admin path');
  target.search = incoming.searchParams.toString();

  const headers: Record<string, string> = { 'x-test-admin-token': token };
  const contentType = request.headers.get('content-type');
  if (contentType) headers['content-type'] = contentType;
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let res: Response;
  try {
    res = await fetch(target, { method: request.method, headers, body: hasBody ? await request.arrayBuffer() : undefined });
  } catch {
    return json(502, 'Cannot reach the simulator API');
  }

  const out = new Headers();
  for (const name of ['content-type', 'x-request-id']) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(await res.arrayBuffer(), { status: res.status, headers: out });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
