import {
  Boxes,
  ChartColumn,
  House,
  KeyRound,
  LayoutDashboard,
  Package,
  Palette,
  Percent,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icons that navigation items may name. Nav items are built on the server and passed to client
 * components, so they carry an icon *name* (serializable), resolved here on the client.
 * Generic names only (no business names). Import icons one by one: only these reach the bundle.
 */
export const navIcons = {
  home: House,
  palette: Palette,
  key: KeyRound,
  dashboard: LayoutDashboard,
  package: Package,
  users: Users,
  truck: Truck,
  cart: ShoppingCart,
  receipt: Receipt,
  boxes: Boxes,
  wallet: Wallet,
  percent: Percent,
  chart: ChartColumn,
  settings: Settings,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof navIcons;
