# src/core

সব ব্যবসার জন্য এক ও সাধারণ অংশ (প্রপোজাল সেকশন ৩)।

দায়িত্ব (ধাপে ধাপে আসবে): auth ও রোল, business registry, module manifest লোডার, layout/sidebar (manifest থেকে তৈরি), ledger/accounts UI কাঠামো, settings, ভাষা ও থিম, report/export কাঠামো, API client।

নিয়ম:

- core কোনো ব্যবসার নাম বা নিয়ম জানবে না। এখানে কোনো নির্দিষ্ট ব্যবসার নাম (যেমন সিমেন্ট বা রডের ব্র্যান্ড) পাওয়া গেলে সেটা ভুল।
- core কখনো `src/modules/*` import করবে না (ESLint `no-restricted-imports` দিয়ে আটকানো)।
