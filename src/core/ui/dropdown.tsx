'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';

export interface DropdownProps {
  /** Accessible name of the toggle button. */
  label: string;
  /** Visible content of the toggle button. */
  trigger: ReactNode;
  /** Panel content; call `close()` after an action (e.g. a link click). */
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  triggerClassName?: string;
  panelClassName?: string;
}

/**
 * Disclosure-style dropdown: a button with aria-expanded that shows a panel of normal links and
 * buttons (Tab moves through them). Esc closes and returns focus to the button; so does a click
 * outside. A solid surface, not glass: blur stays limited to cards, sidebar and modals.
 */
export function Dropdown({
  label,
  trigger,
  children,
  align = 'end',
  triggerClassName,
  panelClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex min-h-10 items-center gap-2 rounded-lg text-fg hover:bg-surface-muted',
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={cn(
          'absolute top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface p-2 text-fg shadow-glass',
          align === 'end' ? 'right-0' : 'left-0',
          panelClassName,
        )}
      >
        {open ? children(() => setOpen(false)) : null}
      </div>
    </div>
  );
}
