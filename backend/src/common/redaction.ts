export const REDACTED = '[REDACTED]';

/** Header/query/body keys whose values must never be stored or logged. */
const SENSITIVE_KEY =
  /^(authorization|proxy-authorization|cookie|set-cookie|password|passwd|secret|sign|signature|auth_code|code_verifier|client_secret|api[-_]?key|app[-_]?secret|appsecret|access[-_]?token|refresh[-_]?token|id[-_]?token|token|x-tts-access-token|x-test-admin-token|x-demo-session|x-webhook-signature|confirmation[-_]?token|confirm[-_]?token)$|(secret|password|token)$/i;

const MAX_DEPTH = 8;
export const MAX_BODY_CHARS = 16 * 1024;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

/** Redact secret-looking substrings inside free text (headers echoed in errors, URLs, JSON strings). */
export function redactString(input: string): string {
  return input
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`)
    // Authorization code inside a redirect URL (`?code=...`); a bare `code` KEY cannot be redacted, TikTok envelopes carry `code: 0`.
    .replace(/([?&]code=)[^&\s"']+/gi, `$1${REDACTED}`)
    .replace(
      /((?:^|[?&"'\s,;(])(?:access_token|refresh_token|app_secret|sign|signature|auth_code|token|secret|password|client_secret)["']?\s*[=:]\s*["']?)([^&"'\s,}]+)/gi,
      `$1${REDACTED}`,
    );
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return REDACTED;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) ? REDACTED : redactValue(v, depth + 1);
  }
  return out;
}

export function redactHeaders(headers: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers ?? {})) {
    out[k.toLowerCase()] = isSensitiveKey(k) ? REDACTED : Array.isArray(v) ? v.map((x) => redactString(String(x))) : redactString(String(v));
  }
  return out;
}

/** Redact a raw body (JSON text, form text or other) and truncate it for storage. */
export function redactBody(raw: string | undefined | null): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  let text = raw;
  try {
    text = JSON.stringify(redactValue(JSON.parse(raw)));
  } catch {
    text = redactString(raw);
  }
  return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}...[truncated]` : text;
}

/** Redact a path that may contain a query string. */
export function redactUrl(url: string): string {
  return redactString(url);
}
