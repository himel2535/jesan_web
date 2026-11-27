'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/core/ui/cn';
import { pillClass, type PillTone } from './period-pills';

export interface PillSelectOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface PanelPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  minWidth: number;
}

const OPTION_HEIGHT = 40;

/**
 * A dropdown dressed as one of the dashboard's pastel pills. It is a plain button that opens a
 * listbox of buttons, not a native `<select>`: a native popup is drawn by the browser (different
 * on every platform and on touch), cannot be seen by tests, and was the thing that kept failing to
 * open from inside a card whose whole surface is a link. Here everything is real DOM.
 *
 * The pill stays ~26px tall; the `before:-inset-y-2` hit area on the button itself gives the 40px
 * touch target. The panel is portalled into the dashboard scope (so the `--dash-*` tokens still
 * apply) and fixed-positioned from the button, so no `overflow` on a card or panel can clip it. It
 * is a solid surface: blur stays on cards, sidebar and modals only.
 */
export function PillSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
  tone = 'card',
  fill = false,
}: {
  label: string;
  value: T;
  options: readonly PillSelectOption<T>[];
  onChange: (value: T) => void;
  tone?: PillTone;
  /** From `sm` up, stretch to share the row with its neighbours (KPI card filter rows). */
  fill?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  // Where the panel is portalled to: the dashboard scope (it carries the --dash-* tokens).
  const [target, setTarget] = useState<Element | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Place the panel under the button (above it when there is no room), aligned to the nearer edge.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setTarget(buttonRef.current.closest('.dash-scope') ?? document.body);
    const needed = options.length * OPTION_HEIGHT + 8;
    const below = window.innerHeight - rect.bottom;
    const up = below < Math.min(needed, 240) && rect.top > below;
    const alignRight = rect.left + rect.width / 2 > window.innerWidth / 2;
    setPosition({
      ...(up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      ...(alignRight
        ? { right: Math.max(8, window.innerWidth - rect.right) }
        : { left: Math.max(8, rect.left) }),
      minWidth: Math.max(rect.width, 72),
    });
  }, [open, options.length]);

  // Focus the chosen option as the list opens, so the arrow keys work straight away.
  useEffect(() => {
    if (!open || !position) return;
    const at = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );
    optionRefs.current[at]?.focus();
    // Only when it opens (the position appearing), not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position === null]);

  // Outside click, Escape, scroll and resize all close it.
  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (buttonRef.current?.contains(target) === true || panelRef.current?.contains(target) === true);
    const onPointerDown = (event: PointerEvent) => {
      if (!inside(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(true);
      }
    };
    const onScroll = (event: Event) => {
      if (!inside(event.target)) setOpen(false);
    };
    const onResize = () => {
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  const move = (from: number, step: 1 | -1) => {
    for (let at = from + step; at >= 0 && at < options.length; at += step) {
      if (!options[at]?.disabled) {
        optionRefs.current[at]?.focus();
        return;
      }
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          setPosition(null);
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setPosition(null);
            setOpen(true);
          }
        }}
        className={cn(
          'relative isolate inline-flex cursor-pointer items-center rounded-md py-1 pr-3.5 pl-1.5 text-[11px] font-medium whitespace-nowrap',
          fill && 'sm:min-w-0 sm:flex-1 sm:justify-center',
          'before:absolute before:inset-x-0 before:-inset-y-2 before:content-[""]',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]',
          pillClass(false, 'blue', tone),
        )}
      >
        <span>{selected?.label}</span>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-0.5 size-3 text-[var(--dash-fg-muted)]"
        />
      </button>
      {open && position && target
        ? createPortal(
            <div
              ref={panelRef}
              id={listId}
              role="listbox"
              aria-label={label}
              style={{ position: 'fixed', ...position }}
              onKeyDown={(event) => {
                const at = optionRefs.current.findIndex((node) => node === document.activeElement);
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  move(at, 1);
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  move(at, -1);
                } else if (event.key === 'Home') {
                  event.preventDefault();
                  move(-1, 1);
                } else if (event.key === 'End') {
                  event.preventDefault();
                  move(options.length, -1);
                } else if (event.key === 'Tab') {
                  setOpen(false);
                }
              }}
              className="z-50 max-h-[min(60vh,20rem)] overflow-y-auto rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] p-1 text-[var(--dash-fg)] shadow-[var(--dash-shadow)]"
            >
              {options.map((option, at) => {
                const chosen = option.value === value;
                return (
                  <button
                    key={option.value}
                    ref={(node) => {
                      optionRefs.current[at] = node;
                    }}
                    type="button"
                    role="option"
                    aria-selected={chosen}
                    disabled={option.disabled}
                    tabIndex={-1}
                    onClick={() => {
                      if (option.disabled) return;
                      onChange(option.value);
                      close(true);
                    }}
                    className={cn(
                      'flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-xs whitespace-nowrap',
                      'hover:bg-[var(--dash-bg)] focus-visible:bg-[var(--dash-bg)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]',
                      'disabled:cursor-not-allowed disabled:text-[var(--dash-fg-muted)] disabled:opacity-50 disabled:hover:bg-transparent',
                      chosen && 'font-semibold',
                    )}
                  >
                    <span>{option.label}</span>
                    {chosen ? (
                      <Check aria-hidden className="size-3.5 text-[var(--dash-primary)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>,
            target,
          )
        : null}
    </>
  );
}
