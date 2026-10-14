import { REDACTED, redactBody, redactHeaders, redactString, redactUrl, redactValue } from '../src/common/redaction';

describe('redaction', () => {
  it('redacts sensitive header names and keeps harmless ones', () => {
    const out = redactHeaders({ Authorization: 'Bearer abc.def', 'x-tts-access-token': 'tok', 'X-Test-Admin-Token': 's3', 'content-type': 'application/json' });
    expect(out.authorization).toBe(REDACTED);
    expect(out['x-tts-access-token']).toBe(REDACTED);
    expect(out['x-test-admin-token']).toBe(REDACTED);
    expect(out['content-type']).toBe('application/json');
  });

  it('redacts nested keys, arrays and token-looking strings', () => {
    const out = redactValue({ a: { access_token: 'x', refresh_token: 'y', app_secret: 'z', ok: 1 }, list: [{ sign: 'sig' }, 'Bearer abcdef'], sessionToken: 'raw' }) as any;
    expect(out.a).toEqual({ access_token: REDACTED, refresh_token: REDACTED, app_secret: REDACTED, ok: 1 });
    expect(out.list[0].sign).toBe(REDACTED);
    expect(out.list[1]).toBe(`Bearer ${REDACTED}`);
    expect(out.sessionToken).toBe(REDACTED);
  });

  it('redacts secrets in URLs and query strings', () => {
    const u = redactUrl('/api/x?app_key=k&access_token=SECRET123&sign=abcdef&page=2');
    expect(u).not.toContain('SECRET123');
    expect(u).not.toContain('abcdef');
    expect(u).toContain('page=2');
    expect(redactString('failed with refresh_token=ZZZ&x=1')).not.toContain('ZZZ');
  });

  it('redacts JSON and non-JSON bodies and truncates large ones', () => {
    expect(redactBody(JSON.stringify({ app_secret: 'shh', name: 'n' }))).not.toContain('shh');
    expect(redactBody('grant=1&client_secret=abc123&x=2')).not.toContain('abc123');
    const big = redactBody(JSON.stringify({ blob: 'x'.repeat(50000) }))!;
    expect(big.length).toBeLessThan(17000);
    expect(big.endsWith('[truncated]')).toBe(true);
    expect(redactBody('')).toBeNull();
  });
});
