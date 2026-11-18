/**
 * Stable error codes of jesan-api (docs/API.md §11), each with its own translated message in
 * `messages/*.json` under `apiErrors.codes`. A test checks both languages have every one.
 *
 * Field-structure codes are `<FIELD>_<PROBLEM>` (e.g. `NAME_EN_REQUIRED`); they are endless, so
 * only some have their own message; the rest use the general message of their PROBLEM suffix.
 */
export const ERROR_CODES = [
  // General
  'VALIDATION_FAILED',
  'BAD_REQUEST',
  'ID_INVALID',
  'NOTHING_TO_CHANGE',
  'REASON_REQUIRED',
  'UNAUTHENTICATED',
  'ACCESS_DENIED',
  'ORIGIN_NOT_ALLOWED',
  'NOT_FOUND',
  'ROUTE_NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
  // Sign-in and password
  'INVALID_CREDENTIALS',
  'CURRENT_PASSWORD_INCORRECT',
  'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG',
  'PASSWORD_MATCHES_IDENTITY',
  // Settings: users and roles
  'USER_NOT_FOUND',
  'USER_ALREADY_EXISTS',
  'EMAIL_OR_PHONE_REQUIRED',
  'PHONE_INVALID',
  'ROLE_NOT_FOUND',
  'OWNER_ROLE_FIXED',
  'PERMISSION_UNKNOWN',
  'PERMISSION_OWNER_ONLY',
  'OWN_STATUS_CHANGE_FORBIDDEN',
  'PLATFORM_OWNER_PROTECTED',
  // Master data
  'NAME_EN_DUPLICATE',
  'PHONE_DUPLICATE',
  'RECORD_DUPLICATE',
  'CATEGORY_NOT_FOUND_OR_INACTIVE',
  'UNIT_UNKNOWN',
  'PRODUCT_NOT_FOUND',
  'CATEGORY_NOT_FOUND',
  'CUSTOMER_NOT_FOUND',
  'SUPPLIER_NOT_FOUND',
  // Change requests (§10)
  'ENTITY_TYPE_UNKNOWN',
  'VOID_NOT_SUPPORTED',
  'PROPOSED_CHANGE_EMPTY',
  'PROPOSED_CHANGE_NOT_ALLOWED',
  'FIELD_NOT_CHANGEABLE',
  'PURCHASE_PRICE_INVALID',
  'OPENING_BALANCE_INVALID',
  'CREDIT_LIMIT_INVALID',
  'IS_ACTIVE_INVALID',
  'IDEMPOTENCY_KEY_INVALID',
  'RECORD_NOT_FOUND',
  'CHANGE_REQUEST_NOT_FOUND',
  'CHANGE_REQUEST_PENDING_EXISTS',
  'CHANGE_REQUEST_ALREADY_DECIDED',
  'SELF_DECISION_FORBIDDEN',
  'STALE_REQUEST',
  'ENTITY_TYPE_UNSUPPORTED',
  'CHANGE_FIELD_UNSUPPORTED',
  // Field-structure codes with a message of their own (examples in §11)
  'NAME_EN_REQUIRED',
  'NAME_BN_REQUIRED',
  'NAME_EN_TOO_LONG',
  'NAME_BN_TOO_LONG',
  'REASON_TOO_SHORT',
  'REASON_TOO_LONG',
  'NOTE_REQUIRED',
  'NOTE_TOO_SHORT',
  'NOTE_TOO_LONG',
  'SORT_ORDER_TOO_LARGE',
  'CATEGORY_ID_INVALID',
  'DEFAULT_SALE_PRICE_NOT_ALLOWED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** The PROBLEM part of a field-structure code (§11); each has one general message. */
export const FIELD_PROBLEMS = [
  'REQUIRED',
  'INVALID',
  'TOO_SHORT',
  'TOO_LONG',
  'TOO_SMALL',
  'TOO_LARGE',
  'NOT_ALLOWED',
] as const;

export type FieldProblem = (typeof FIELD_PROBLEMS)[number];

const KNOWN = new Set<string>(ERROR_CODES);

/** `apiErrors.<key>` for a code: its own message, else its problem's, else undefined. */
export function messageKeyForCode(code: string): string | undefined {
  if (KNOWN.has(code)) return `codes.${code}`;
  const problem = FIELD_PROBLEMS.find((p) => code.endsWith(`_${p}`));
  return problem ? `problems.${problem}` : undefined;
}
