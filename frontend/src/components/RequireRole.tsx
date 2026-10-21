import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';

/** Sign-in URL that brings the user back to `next` afterwards; seller sign-ins open the Seller tab. */
export function loginUrl(next: string, role: Role = 'BUYER'): string {
  return `/login?next=${encodeURIComponent(next)}${role === 'SELLER' ? '&role=seller' : ''}`;
}

/** Renders its children (or the nested routes) only with a session of `role`; otherwise sends the user to /login. */
export function RequireRole({ role, children }: { role: Role; children?: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.session(role)) return <Navigate to={loginUrl(location.pathname + location.search, role)} replace />;
  return children ?? <Outlet />;
}
