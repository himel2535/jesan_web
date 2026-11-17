import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { serverApiBaseUrl } from './src/core/api/config';

const withNextIntl = createNextIntlPlugin('./src/core/i18n/request.ts');

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `page.dev.tsx` routes (e.g. /dev/ui) exist only in development.
  pageExtensions: isProduction ? ['tsx', 'ts'] : ['dev.tsx', 'tsx', 'ts'],
  poweredByHeader: false,
  /**
   * Same-site API proxy (DECISIONS.md, "Session"): the browser calls /api/v1/* on this site and
   * Next forwards it to jesan-api, passing Set-Cookie back untouched. Rewrites are resolved at
   * BUILD time, so API_INTERNAL_URL must be set before `next build` in every deployment.
   * Real route files (e.g. /api/v1/auth/resume) are matched before these rewrites.
   */
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${serverApiBaseUrl()}/:path*` }];
  },
};

export default withNextIntl(nextConfig);
