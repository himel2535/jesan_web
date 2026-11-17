# src/core

সব ব্যবসার জন্য এক ও সাধারণ অংশ (প্রপোজাল সেকশন ৩)।

দায়িত্ব (ধাপে ধাপে আসবে): auth ও রোল, business registry, module manifest লোডার, layout/sidebar (manifest থেকে তৈরি), ledger/accounts UI কাঠামো, settings, ভাষা ও থিম, report/export কাঠামো, API client।

ফোল্ডার:

- `api/` — `apiFetch` (ব্রাউজার), `serverApiGet` (সার্ভার), ত্রুটির রূপ, TanStack Query ও module-ভিত্তিক query key।
- `auth/` — সেশন (`getSession`, `requireSession`), resume ও `next` পথ, অনুমতি (`can`, `useCan`, `<Can>`), লগইন ও পাসওয়ার্ড বদলের ফর্ম।
- `module-system/` — module manifest-এর ধরন, অনুমতি অনুযায়ী ব্যবসার মেনু, `/b/[slug]`-এর ব্যবসা খোঁজা। কোনো নির্দিষ্ট module import করে না।
- `i18n/` — ভাষা নির্বাচন (cookie), next-intl কনফিগ, সংখ্যা/টাকা/তারিখের helper।
- `theme/` — থিম cookie ও design token (`tokens.css`)।
- `navigation/` — সাইডবার মেনুর ধরন (পরে module manifest এখান দিয়ে আসবে)।
- `settings/` — ব্যবসার Settings: রোল × অনুমতির ছক, ইউজার ব্যবস্থাপনা, তাদের query key ও API hooks।
- `ui/` — AppShell, Sidebar, Topbar, Modal, Pagination, Button, Card ইত্যাদি।
- `lib/` — ছোট সাধারণ helper।

নিয়ম:

- core কোনো ব্যবসার নাম বা নিয়ম জানবে না। এখানে কোনো নির্দিষ্ট ব্যবসার নাম (যেমন সিমেন্ট বা রডের ব্র্যান্ড) পাওয়া গেলে সেটা ভুল।
- core কখনো `src/modules/*` import করবে না (ESLint `no-restricted-imports` দিয়ে আটকানো)।
