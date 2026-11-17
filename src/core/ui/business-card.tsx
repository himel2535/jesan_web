'use client';

import { ArrowRight, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface BusinessCardProps {
  href: string;
  name: string;
  typeLabel: string;
  /** Already translated, e.g. "Your role: Manager" (translated on the server). */
  roleText: string;
}

/**
 * One business on the Enterprise Dashboard. The whole card is one link (one Tab stop); its text
 * (name, type, role) is the link's accessible name.
 */
export function BusinessCard({ href, name, typeLabel, roleText }: BusinessCardProps) {
  const router = useRouter();
  // The business dashboard is light: prefetch only when the user points at or focuses the card.
  const prefetch = () => router.prefetch(href);

  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      className="group flex min-h-36 flex-col justify-between gap-4 rounded-card glass p-5 text-fg transition-shadow hover:shadow-card"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg">
          <Building2 aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{name}</h2>
          <p className="text-sm text-fg-muted">{typeLabel}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-fg-muted">{roleText}</span>
        <ArrowRight
          aria-hidden
          className="size-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </div>
    </Link>
  );
}
