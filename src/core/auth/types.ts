/** Shapes of GET /auth/me (docs/API.md §7). */
export interface LocalizedName {
  nameEn: string;
  nameBn: string;
}

export interface MeUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  isPlatformOwner: boolean;
}

export interface MeRole extends LocalizedName {
  id: string;
  key: string;
}

export interface MeBusiness extends LocalizedName {
  id: string;
  slug: string;
  type: string;
  role: MeRole;
  /** Permission keys in this business, alphabetical. UI hint only — the API enforces them. */
  permissions: string[];
}

export interface Me {
  user: MeUser;
  businesses: MeBusiness[];
}

export function localizedName(item: LocalizedName, locale: string): string {
  return locale === 'bn' ? item.nameBn : item.nameEn;
}
