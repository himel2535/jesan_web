import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jesan Enterprise',
  description: 'Jesan Enterprise business platform',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="bn">
      <body
        suppressHydrationWarning
        className="min-h-screen bg-white font-sans text-neutral-900 antialiased"
      >
        {children}
      </body>
    </html>
  );
}
