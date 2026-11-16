import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/** Glass surface. Do not wrap long tables or lists in a Card (blur slows scrolling). */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card glass p-5 text-fg', className)} {...props} />;
}
