/** jesan-api's password rules (docs/API.md §7). Checked before sending; the API checks again. */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export type PasswordRuleError = 'required' | 'tooShort' | 'tooLong' | 'sameAsIdentity';

export interface PasswordIdentity {
  email?: string | null;
  phone?: string | null;
}

/** Phone digits without country code, so 01712…, 8801712… and +8801712… compare equal. */
function phoneDigits(value: string): string {
  return value.replace(/\D/g, '').replace(/^88/, '');
}

/**
 * The first rule a new password breaks, or undefined. `identity` is the email/phone of the account
 * whose password it will be (the user themself, or the user being reset or created).
 */
export function passwordRuleError(
  password: string,
  identity: PasswordIdentity,
): PasswordRuleError | undefined {
  if (!password) return 'required';
  if (password.length < PASSWORD_MIN) return 'tooShort';
  if (password.length > PASSWORD_MAX) return 'tooLong';
  const email = identity.email?.trim().toLowerCase();
  if (email && password.trim().toLowerCase() === email) return 'sameAsIdentity';
  const phone = identity.phone ? phoneDigits(identity.phone) : '';
  if (phone && phoneDigits(password) === phone) return 'sameAsIdentity';
  return undefined;
}
