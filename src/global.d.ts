import type en from '../messages/en.json';
import type { Locale } from '@/core/i18n/config';

// Type-safe translation keys: a wrong key in t('...') is a type error.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
