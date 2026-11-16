# src/core

সব ব্যবসার জন্য এক ও সাধারণ অংশ (প্রপোজাল সেকশন ৩)।

দায়িত্ব (ধাপে ধাপে আসবে): auth ও রোল, business registry, module manifest লোডার, layout/sidebar (manifest থেকে তৈরি), ledger/accounts UI কাঠামো, settings, ভাষা ও থিম, report/export কাঠামো, API client।

ফোল্ডার:

- `api/` — `apiFetch` (cookie, timeout, ত্রুটির রূপ, 401-এ refresh), TanStack Query client ও module-ভিত্তিক query key।
- `i18n/` — ভাষা নির্বাচন (cookie), next-intl কনফিগ, সংখ্যা/টাকা/তারিখের helper।
- `theme/` — থিম cookie ও design token (`tokens.css`)।
- `navigation/` — সাইডবার মেনুর ধরন (পরে module manifest এখান দিয়ে আসবে)।
- `ui/` — AppShell, Sidebar, Topbar, Modal, Pagination, Button, Card ইত্যাদি।
- `lib/` — ছোট সাধারণ helper।

নিয়ম:

- core কোনো ব্যবসার নাম বা নিয়ম জানবে না। এখানে কোনো নির্দিষ্ট ব্যবসার নাম (যেমন সিমেন্ট বা রডের ব্র্যান্ড) পাওয়া গেলে সেটা ভুল।
- core কখনো `src/modules/*` import করবে না (ESLint `no-restricted-imports` দিয়ে আটকানো)।
