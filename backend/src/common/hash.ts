import { createHash, randomBytes } from 'crypto';

/** SHA-256 hex digest. Tokens, codes and session secrets are stored only in this form. */
export const hashToken = (raw: string): string => createHash('sha256').update(raw).digest('hex');

/** Opaque random secret with a readable, non-secret prefix. The raw value is returned exactly once. */
export const newSecret = (prefix: string): string => `${prefix}_${randomBytes(32).toString('base64url')}`;
