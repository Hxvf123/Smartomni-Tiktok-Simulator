import { createHmac, timingSafeEqual } from 'crypto';

// API request signature. Mirrors contracts/signing/sign.ts (indirect evidence only, see contracts/signing/README.md);
// re-implemented here because the Docker build context is ./backend. test/tiktok-auth.e2e-spec.ts replays
// contracts/signing/test-vectors.json against this implementation so the two cannot drift silently.
const EXCLUDED_QUERY_KEYS = new Set(['sign', 'access_token']);

export function apiStringToSign(secret: string, path: string, query: Record<string, string>, rawBody: string): string {
  let s = secret + path;
  for (const k of Object.keys(query).filter((k) => !EXCLUDED_QUERY_KEYS.has(k)).sort()) s += k + query[k];
  return s + rawBody + secret;
}

export function computeApiSignature(secret: string, path: string, query: Record<string, string>, rawBody: string): string {
  return createHmac('sha256', secret).update(apiStringToSign(secret, path, query, rawBody)).digest('hex');
}

export function signatureMatches(expectedHex: string, given: string): boolean {
  const a = Buffer.from(expectedHex, 'utf8');
  const b = Buffer.from(given.toLowerCase(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Query as the client signed it: parsed from the raw URL (not Express's `qs` result, which turns repeated keys and
 * `a[b]` into arrays/objects). Returns null when a key repeats, because the string to sign would be ambiguous.
 */
export function parseRawQuery(originalUrl: string): { path: string; query: Record<string, string> } | null {
  const idx = originalUrl.indexOf('?');
  const path = idx === -1 ? originalUrl : originalUrl.slice(0, idx);
  const query: Record<string, string> = {};
  if (idx !== -1) {
    for (const [k, v] of new URLSearchParams(originalUrl.slice(idx + 1))) {
      if (Object.prototype.hasOwnProperty.call(query, k)) return null;
      query[k] = v;
    }
  }
  return { path, query };
}
