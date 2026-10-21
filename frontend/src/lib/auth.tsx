import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createSession, endSession } from './endpoints';
import { load, SESSION_CHANGED, sessionKey } from './session';
import type { DemoSession, Role, SignInIdentity } from './types';

/**
 * Demo sign-in state for the new pages. One session per role, stored under the same sessionStorage keys
 * as the legacy pages (`sim.demo-session.{ROLE}`), so both see the same sign-in. Not a TikTok or SmartOmni login.
 */
export interface AuthValue {
  buyer: DemoSession | null;
  seller: DemoSession | null;
  session: (role: Role) => DemoSession | null;
  signIn: (identity: SignInIdentity) => Promise<DemoSession>;
  signOut: (role: Role) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const isExpired = (s: DemoSession) => new Date(s.expiresAt).getTime() <= Date.now();

function store(role: Role, s: DemoSession | null) {
  try {
    if (s) sessionStorage.setItem(sessionKey(role), JSON.stringify(s));
    else sessionStorage.removeItem(sessionKey(role));
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

function loadValid(role: Role): DemoSession | null {
  const s = load(role);
  if (s && isExpired(s)) {
    store(role, null);
    return null;
  }
  return s;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<Role, DemoSession | null>>(() => ({
    BUYER: loadValid('BUYER'),
    SELLER: loadValid('SELLER'),
  }));

  useEffect(() => {
    const reload = () => setSessions({ BUYER: loadValid('BUYER'), SELLER: loadValid('SELLER') });
    window.addEventListener(SESSION_CHANGED, reload);
    return () => window.removeEventListener(SESSION_CHANGED, reload);
  }, []);

  const put = useCallback((role: Role, s: DemoSession | null) => {
    store(role, s);
    setSessions((prev) => ({ ...prev, [role]: s }));
  }, []);

  const signIn = useCallback(
    async (identity: SignInIdentity) => {
      const s = await createSession(identity);
      put(s.role, s);
      return s;
    },
    [put],
  );

  const signOut = useCallback(
    async (role: Role) => {
      const s = sessions[role];
      put(role, null);
      if (s) {
        try {
          await endSession(s);
        } catch {
          /* already expired or API down: the local sign-out is what matters */
        }
      }
    },
    [put, sessions],
  );

  const value = useMemo<AuthValue>(
    () => ({
      buyer: sessions.BUYER,
      seller: sessions.SELLER,
      session: (role) => sessions[role],
      signIn,
      signOut,
    }),
    [sessions, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
