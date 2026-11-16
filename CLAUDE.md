# CLAUDE.md — jesan-web

Jesan Enterprise মাল্টি-বিজনেস ERP প্ল্যাটফর্মের frontend (Next.js App Router)। Backend আলাদা repo: jesan-api। প্রধান নির্দেশনা রুটের প্রপোজাল PDF (v3); কাজের আগে সংশ্লিষ্ট সেকশন পড়ো।

## প্রতিটা কাজের পর (বাধ্যতামূলক)

```bash
npm run dev          # চালিয়ে পেজ নিজে দেখো
npm run lint
npm run type-check
npm run build
```

চারটাই পাস না করলে কাজ শেষ নয়। `npm run format` দিয়ে ফরম্যাট ঠিক রাখো।

## স্থাপত্য (প্রপোজাল সেকশন ৩)

- `src/core` সবার জন্য এক; কোনো ব্যবসার নাম বা নিয়ম core-এ নয়।
- `src/modules/<type>` (এখন `dealership`) শুধু core ব্যবহার করবে। core কখনো module import করবে না (ESLint দিয়ে আটকানো), এক module অন্য module সরাসরি ডাকবে না।
- API ডাকা শুধু `src/core/api` এর মাধ্যমে।
- Route: `/` Enterprise Dashboard, ব্যবসার ভেতরে `/b/[businessSlug]/...`।

## পারফরম্যান্স চেকলিস্ট (সেকশন ৯.৬) — প্রতিটা feature শেষে

1. এই পেজ/API কি পুরো table আনছে? (pagination আছে?)
2. প্রতিটা ফিল্টার ও join-এর কলামে index আছে? EXPLAIN ANALYZE দেখেছি?
3. লুপের ভেতরে কোনো query বা ক্রমিক await আছে? (স্বাধীন কাজ `Promise.all`-এ)
4. সেভ বাটনে double-click করলে একই কাজ দুইবার হয়? (idempotency key আছে?)
5. দুজন একসাথে এই কাজ করলে stock/নম্বর/বাকি ভুল হয়? (atomic ও transaction আছে?)
6. সেভের পর অপ্রয়োজনীয় query-ও কি refetch হচ্ছে?
7. ১ লক্ষ invoice-এর seed ডেটায় লক্ষ্যমাত্রা মিলছে?

Frontend-এ এছাড়া: ডেটা-ভারী লিংকে prefetch বন্ধ বা hover-এ, sidebar নিজে fetch করবে না, ভারী লাইব্রেরি dynamic import, যেখানে সম্ভব Server Component, বড় তালিকা/table-এর উপর backdrop blur নয়, লোডিং-এ skeleton।

## সিদ্ধান্ত ও ভার্সন

- প্রতিটা সিদ্ধান্ত (বিশেষ করে প্রপোজাল থেকে সরে আসা) এক লাইনে `DECISIONS.md`-তে লেখো।
- নতুন প্যাকেজের আগে `npm view <pkg> version dist-tags` ও peer dependency দেখো। শুধু সর্বশেষ stable; RC/beta/canary নয়। `--force` বা `--legacy-peer-deps` কখনো নয়। exact version-এ install করো, lockfile commit করো।
- Node 22 (`.nvmrc`), কারণ DECISIONS.md-তে।

## Secret

কোনো আসল secret, token, পাসওয়ার্ড বা connection string কখনো কোডে, চ্যাটে বা commit-এ নয়। লোকাল মান `.env.local`-এ (git-ignored); নতুন env variable-এর নাম ও নিরাপদ উদাহরণ `.env.example`-এ। `NEXT_PUBLIC_*` ব্রাউজারে যায়, তাই তাতে কখনো secret নয়।
