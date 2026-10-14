import { useCallback, useState } from 'react';

export interface DemoSession {
  sessionToken: string;
  role: 'SELLER' | 'BUYER';
  shopId: string;
  buyerId: string | null;
  expiresAt: string;
}

const key = (role: string) => `sim.demo-session.${role}`;

function load(role: string): DemoSession | null {
  try {
    const raw = sessionStorage.getItem(key(role));
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
        if (s) sessionStorage.setItem(key(role), JSON.stringify(s));
        else sessionStorage.removeItem(key(role));
      } catch {
        /* storage unavailable: keep in memory only */
      }
      setSession(s);
    },
    [role],
  );
  return [session, save] as const;
}
