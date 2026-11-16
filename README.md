# jesan-web

Jesan Enterprise (জিসান এন্টারপ্রাইজ) মাল্টি-বিজনেস ERP প্ল্যাটফর্মের frontend। Backend আলাদা repo: **jesan-api**।

বর্তমান অবস্থা: frontend-এর ভিত্তি তৈরি — সাদা/কালো থিম (glassmorphism), বাংলা/ইংরেজি, সাইডবার-টপবারসহ অ্যাপের কাঠামো, API ক্লায়েন্ট ও TanStack Query। হোম পেজ backend-এর `/health` যাচাই করে "Backend: চলছে" বা "Backend: বন্ধ" দেখায়। লগইন ও ব্যবসার ফিচার পরের ধাপে।

## প্রযুক্তি

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 (CSS-first) · next-intl · TanStack Query · Vitest · ESLint 9 · Prettier। ভার্সন ও কারণ: [DECISIONS.md](./DECISIONS.md)।

## লোকালে চালানো (Node 22)

1. Node 22 নাও (nvm থাকলে রুটে `.nvmrc` আছে):

   ```bash
   nvm use
   ```

2. ভার্সন দেখো (Node ≥ 22.22.2 লাগবে):

   ```bash
   node -v
   ```

3. প্যাকেজ ইনস্টল (lockfile মেনে):

   ```bash
   npm ci
   ```

4. env ফাইল বানাও এবং দরকারে `NEXT_PUBLIC_API_URL` বদলাও:

   ```bash
   cp .env.example .env.local
   ```

5. ডেভ সার্ভার চালাও, তারপর http://localhost:3000 খোলো:

   ```bash
   npm run dev
   ```

jesan-api না চললে পেজে "Backend: বন্ধ" দেখানো স্বাভাবিক। প্রথমবার dev বা build-এ ফন্ট নামাতে ইন্টারনেট লাগে।

সব UI উপাদান দুই থিমে একসাথে দেখতে ডেভে http://localhost:3000/dev/ui খোলো (production-এ এই পেজ নেই)। ভাষা ও থিম উপরের বার থেকে বদলায়, পছন্দ cookie-তে মনে থাকে।

## স্ক্রিপ্ট

| কমান্ড                             | কাজ                       |
| --------------------------------- | ------------------------- |
| `npm run dev`                     | ডেভ সার্ভার                |
| `npm run build` / `npm run start` | production build ও চালানো |
| `npm run lint`                    | ESLint                    |
| `npm run type-check`              | `tsc --noEmit`            |
| `npm test` / `npm run test:watch` | Vitest টেস্ট               |
| `npm run format` / `format:check` | Prettier                  |

## Environment variable

| নাম                   | ডিফল্ট                          | কাজ                                                    |
| --------------------- | ------------------------------ | ------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api/v1` | jesan-api-এর base URL (ব্রাউজারে দৃশ্যমান, তাই secret নয়) |

আসল মান `.env.local`-এ রাখো; এটা git-এ যায় না।

## ফোল্ডার

```
messages/                 অনুবাদ: en.json, bn.json
src/app/                  Next.js routes (App Router); (app)/ = সাইডবারসহ পেজ
src/core/                 সব ব্যবসার জন্য এক অংশ (ব্যবসার নাম নিষেধ)
src/core/api/             backend-এর সাথে যোগাযোগ, TanStack Query
src/core/i18n/            ভাষা ও সংখ্যা/টাকা/তারিখের ফরম্যাট
src/core/theme/           থিম ও design token
src/core/ui/              অ্যাপের কাঠামো ও পুনর্ব্যবহারযোগ্য উপাদান
src/modules/dealership/   generic dealership module (আকিজ সিমেন্ট, পরে BSRM)
test/                     টেস্টের setup ও helper
```

প্রতিটা ফোল্ডারের README-তে তার দায়িত্ব লেখা আছে।
