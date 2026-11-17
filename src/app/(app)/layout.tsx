import type { ReactNode } from 'react';
import { SessionProvider } from '@/core/auth/session-context';
import { requireSession } from '@/core/auth/session';
import { ServiceUnavailable } from '@/core/auth/ui/service-unavailable';

/**
 * Every page in this group needs a signed-in user. The session is checked on the server with the
 * cookie (GET /auth/me); without one the user is resumed or sent to /login with a `next` link.
 */
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  if (session.status === 'unavailable') return <ServiceUnavailable />;
  return <SessionProvider me={session.me}>{children}</SessionProvider>;
}
