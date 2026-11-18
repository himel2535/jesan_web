'use client';

import { RequestChangeButton, type RequestTarget } from '@/core/approvals/request-dialog';
import { useCan } from '@/core/auth/can';
import { hasDueFields } from '../customers/customers-list';
import type { Category, Customer, Product } from '../types';
import { useNameOf } from './display';
import { SensitiveSection } from './fields';

/**
 * What a user may ASK to change (docs/API.md §10): only with `change.request`, only fields the
 * API sent and the user may see, and only what they cannot change directly. An owner (direct
 * permissions) gets null: no request button at all.
 */
function finish(
  canRequest: boolean,
  target: Omit<RequestTarget, 'status'> & { status?: RequestTarget['status'] },
): RequestTarget | null {
  if (!canRequest || (target.fields.length === 0 && !target.status)) return null;
  return target;
}

export function useProductRequestTarget(p: Product | undefined): RequestTarget | null {
  const nameOf = useNameOf();
  const canRequest = useCan('change.request');
  const canDeactivate = useCan('product.deactivate');
  if (!p) return null;
  return finish(canRequest, {
    entityType: 'product',
    entityId: p.id,
    name: nameOf(p),
    // Products have no hand-set price any more; only (de)activation can be requested.
    fields: [],
    status: canDeactivate ? undefined : { currentlyActive: p.isActive },
  });
}

export function useCustomerRequestTarget(c: Customer | undefined): RequestTarget | null {
  const nameOf = useNameOf();
  const canRequest = useCan('change.request');
  const canSeeDue = useCan('customer.due.view');
  const canEditBalance = useCan('customer.balance.edit');
  const canDeactivate = useCan('customer.deactivate');
  if (!c) return null;
  const due = canSeeDue && !canEditBalance && hasDueFields(c);
  return finish(canRequest, {
    entityType: 'customer',
    entityId: c.id,
    name: nameOf(c),
    fields: due
      ? [
          ...(c.openingBalance !== undefined
            ? [{ key: 'openingBalance', type: 'signedMoney' as const, current: c.openingBalance }]
            : []),
          ...(c.creditLimit !== undefined
            ? [{ key: 'creditLimit', type: 'moneyOrNone' as const, current: c.creditLimit }]
            : []),
        ]
      : [],
    status: canDeactivate ? undefined : { currentlyActive: c.isActive },
  });
}

export function useCategoryRequestTarget(): (c: Category) => RequestTarget | null {
  const nameOf = useNameOf();
  const canRequest = useCan('change.request');
  const canDeactivate = useCan('product.deactivate');
  return (c) =>
    canDeactivate
      ? null
      : finish(canRequest, {
          entityType: 'product_category',
          entityId: c.id,
          name: nameOf(c),
          fields: [],
          status: { currentlyActive: c.isActive },
        });
}

/** On a detail page: the owner-level box with only the request button (when there is one). */
export function CorrectionSection({
  slug,
  target,
  onSent,
}: {
  slug: string;
  target: RequestTarget | null;
  onSent: (message: string) => void;
}) {
  if (!target) return null;
  return (
    <SensitiveSection
      editable={false}
      requestSlot={<RequestChangeButton slug={slug} target={target} onSent={onSent} />}
    >
      {null}
    </SensitiveSection>
  );
}
