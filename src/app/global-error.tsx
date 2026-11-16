'use client';

import bn from '../../messages/bn.json';
import en from '../../messages/en.json';
import './globals.css';

/**
 * Shown when the root layout itself fails, so neither the locale nor the translation provider is
 * available. Both languages are shown, read straight from the translation files.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="bn" data-theme="system">
      <body className="flex min-h-dvh items-center justify-center bg-bg p-6 font-sans text-fg">
        <main className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">{bn.errors.title}</h1>
          <p lang="en" className="text-fg-muted">
            {en.errors.title}
          </p>
          <button
            type="button"
            onClick={reset}
            className="min-h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg"
          >
            {bn.common.retry} / {en.common.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
