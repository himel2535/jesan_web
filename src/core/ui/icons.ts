import { House, Palette, type LucideIcon } from 'lucide-react';

/**
 * Icons that navigation items may name. Nav items are built on the server and passed to client
 * components, so they carry an icon *name* (serializable), resolved here on the client.
 * Import icons one by one: only what is listed ends up in the bundle.
 */
export const navIcons = {
  home: House,
  palette: Palette,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof navIcons;
