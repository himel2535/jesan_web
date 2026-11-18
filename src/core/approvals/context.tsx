'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ChangeEntityConfig } from '@/core/module-system/types';

const ChangeEntitiesContext = createContext<Readonly<Record<string, ChangeEntityConfig>>>({});

/** The business module's `changeEntities` (from its manifest), handed down by the layout. */
export function ChangeEntitiesProvider({
  entities,
  children,
}: {
  entities: Readonly<Record<string, ChangeEntityConfig>>;
  children: ReactNode;
}) {
  return (
    <ChangeEntitiesContext.Provider value={entities}>{children}</ChangeEntitiesContext.Provider>
  );
}

export function useChangeEntities() {
  return useContext(ChangeEntitiesContext);
}

/** Link to the record a request is about, or null when the module does not know the type. */
export function recordHref(
  entities: Readonly<Record<string, ChangeEntityConfig>>,
  slug: string,
  entityType: string,
  entityId: string,
): string | null {
  const config = entities[entityType];
  if (!config) return null;
  return `/b/${encodeURIComponent(slug)}/${config.path.replace(':id', encodeURIComponent(entityId))}`;
}
