'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { makeQueryClient } from './query-client';

export function QueryProvider({ children }: { children: ReactNode }) {
  // One client per browser session; created lazily so it is never shared between server requests.
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
