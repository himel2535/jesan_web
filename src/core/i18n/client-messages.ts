import type { Messages } from 'next-intl';

/**
 * Translation namespaces that client components read. Only these are serialized into the page;
 * server components get every namespace on the server without sending it to the browser.
 * Add a module's namespace here only if its client components need it.
 */
export const CLIENT_NAMESPACES = [
  'common',
  'nav',
  'shell',
  'theme',
  'locale',
  'pagination',
  'errors',
  'auth',
  'session',
  'business',
  'userMenu',
  'account',
] as const satisfies readonly (keyof Messages)[];

const DEV_ONLY_NAMESPACES = ['demo'] as const satisfies readonly (keyof Messages)[];

export function pickClientMessages(
  messages: Messages,
  isProduction = process.env.NODE_ENV === 'production',
): Partial<Messages> {
  const namespaces = isProduction
    ? CLIENT_NAMESPACES
    : [...CLIENT_NAMESPACES, ...DEV_ONLY_NAMESPACES];
  return Object.fromEntries(namespaces.map((ns) => [ns, messages[ns]])) as Partial<Messages>;
}
