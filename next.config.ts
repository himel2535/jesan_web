import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/core/i18n/request.ts');

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `page.dev.tsx` routes (e.g. /dev/ui) exist only in development.
  pageExtensions: isProduction ? ['tsx', 'ts'] : ['dev.tsx', 'tsx', 'ts'],
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
