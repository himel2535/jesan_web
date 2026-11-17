'use client';

import { navigateTo } from '@/core/lib/navigation';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { setAuthFailureHandler } from '@/core/api/client';
import { loginPath } from './next-path';
import type { Me, MeBusiness } from './types';

const SessionContext = createContext<Me | null>(null);
const BusinessContext = createContext<MeBusiness | null>(null);

/** Sends the browser to /login (full reload clears every cached query), keeping the current page. */
export function goToLogin(): void {
  const { pathname, search } = window.location;
  navigateTo(loginPath(`${pathname}${search}`));
}

/**
 * The checked session (GET /auth/me, done on the server) for client components. No token is ever
 * in JavaScript: cookies are HttpOnly. When a client API call finds the session over (refresh and
 * retry both 401), the user is sent to /login.
 */
export function SessionProvider({ me, children }: { me: Me; children: ReactNode }) {
  useEffect(() => {
    setAuthFailureHandler(goToLogin);
    return () => setAuthFailureHandler(null);
  }, []);
  return <SessionContext.Provider value={me}>{children}</SessionContext.Provider>;
}

export function useSession(): Me {
  const me = useContext(SessionContext);
  if (!me) throw new Error('useSession must be used inside <SessionProvider>');
  return me;
}

/** The business the user is inside (/b/[slug]/...), with their role and permissions there. */
export function BusinessProvider({
  business,
  children,
}: {
  business: MeBusiness;
  children: ReactNode;
}) {
  return <BusinessContext.Provider value={business}>{children}</BusinessContext.Provider>;
}

export function useCurrentBusiness(): MeBusiness | null {
  return useContext(BusinessContext);
}
