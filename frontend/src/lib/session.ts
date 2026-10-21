import { useCallback, useState } from 'react';
import type { DemoSession } from './types';

export type { DemoSession };

/** sessionStorage key shared by the legacy pages and the new AuthProvider. */
export const sessionKey = (role: string) => `sim.demo-session.${role}`;

export function load(role: string): DemoSession | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(role));
    return raw ? (JSON.parse(raw) as DemoSession) : null;
  } catch {
    return null;
  }
}

/** Demo session token kept in sessionStorage only (tab-scoped); it is not a TikTok or SmartOmni credential. */
export function useDemoSession(role: 'SELLER' | 'BUYER') {
  const [session, setSession] = useState<DemoSession | null>(() => load(role));
  const save = useCallback(
    (s: DemoSession | null) => {
      try {
        if (s) sessionStorage.setItem(sessionKey(role), JSON.stringify(s));
        else sessionStorage.removeItem(sessionKey(role));
      } catch {
        /* storage unavailable: keep in memory only */
      }
      setSession(s);
    },
    [role],
  );
  return [session, save] as const;
}
