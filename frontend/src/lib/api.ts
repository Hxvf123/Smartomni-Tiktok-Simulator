export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  demoSession?: string;
}

/**
 * Same-origin calls. The test-admin token is added by the reverse proxy (nginx / Vite dev proxy),
 * never by browser code, so it is not part of the bundle.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.demoSession) headers['x-demo-session'] = opts.demoSession;
  let res: Response;
  try {
    res = await fetch(path, { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch {
    throw new ApiError('Cannot reach the simulator API (is it running?)', 0);
  }
  const requestId = res.headers.get('x-request-id') ?? undefined;
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = typeof data === 'object' && data && 'message' in data ? String((data as { message: unknown }).message) : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, requestId);
  }
  return data as T;
}

export const vnd = (n: number): string => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
