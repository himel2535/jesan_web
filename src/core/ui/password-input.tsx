'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { cn } from './cn';
import { inputClass } from './text-field';

/** Password field with a show/hide toggle button (aria-pressed), for forms in core/ui. */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(function PasswordInput({ className, ...props }, ref) {
  const t = useTranslations('auth');
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn(inputClass, 'pr-12', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-pressed={visible}
        aria-label={visible ? t('hidePassword') : t('showPassword')}
        title={visible ? t('hidePassword') : t('showPassword')}
        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-lg text-fg-muted hover:text-fg"
      >
        {visible ? (
          <EyeOff aria-hidden className="size-5" />
        ) : (
          <Eye aria-hidden className="size-5" />
        )}
      </button>
    </div>
  );
});
