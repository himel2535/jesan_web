import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Full-width message page: forbidden, coming soon, server unavailable. */
export function StatusPage({
  icon: Icon,
  title,
  description,
  action,
  headingLevel = 1,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  /** 2 when the page already has its own <h1> (e.g. a PageHeader above). */
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <Icon aria-hidden className="size-12 text-fg-muted" />
      <Heading className="text-page-title font-semibold text-fg">{title}</Heading>
      <p className="text-fg-muted">{description}</p>
      {action}
    </section>
  );
}
