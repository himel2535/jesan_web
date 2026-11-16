# DECISIONS.md — jesan-web

প্রতিটা সিদ্ধান্ত এক লাইনে বা ছোট অনুচ্ছেদে। নতুনটা নিচে যোগ হবে।

## ২০২৬-১১-১৬ — শুরুর কাঠামো

### রানটাইম

- **Node 22 LTS** (`.nvmrc` = `22`, `engines.node` = `>=22.12`)। প্রপোজালে Node 26 LTS ছিল, কিন্তু ডেভেলপারের Mac macOS 12.7.6-এ আটকে (আপডেট সম্ভব নয়), তাই Node 22 নেওয়া হয়েছে। নিচের সব প্যাকেজের `engines` Node 22 অনুমোদন করে। হোস্টিং/macOS বাধা উঠলে 26-এ যাওয়া হবে।
- যাচাইয়ের পরিবেশ: ডেভেলপারের Mac — Node 22.23.5, npm 10.9.9, git 2.37.1; ক্লাউড সেশন — Node 22.23.4, npm 10.9.9, git 2.43.0।

### ভার্সন তালিকা (`npm view`, ১৬ নভেম্বর ২০২৬; সব exact pin)

| প্যাকেজ                             | ভার্সন      | নোট                                   |
| ---------------------------------- | ---------- | ------------------------------------- |
| next                               | 16.4.6     | `latest`; engines `>=20.9.0`          |
| react / react-dom                  | 19.3.1     | একই ভার্সন                             |
| tailwindcss / @tailwindcss/postcss | 4.3.5      | CSS-first কনফিগ                       |
| typescript                         | **6.0.3**  | `latest` 7.0.2 নয় — নিচে কারণ         |
| eslint                             | **9.39.5** | `latest` 10.15.0 নয় — নিচে কারণ       |
| eslint-config-next                 | 16.4.6     | flat config                           |
| eslint-config-prettier             | 10.1.8     |                                       |
| prettier                           | 3.10.1     |                                       |
| prettier-plugin-tailwindcss        | 0.8.1      |                                       |
| @types/node                        | 22.20.5    | রানটাইম Node 22-এর সাথে মিল (26.x নয়) |
| @types/react / @types/react-dom    | 19.3.0     |                                       |

### সর্বশেষ থেকে সরে আসা (peer dependency)

- **TypeScript 6.0.3, 7 নয়:** `typescript-eslint@8.72.2` ও `@typescript-eslint/parser@8.72.2`-এর peer `typescript >=4.8.4 <6.1.0`, আর `eslint-config-next@16.4.6` এর উপর নির্ভর করে। তাই 6.x-এর সর্বশেষ। typescript-eslint TS 7 সমর্থন করলে আপগ্রেড।
- **ESLint 9.39.5, 10 নয়:** `eslint-config-next`-এর ভেতরের `eslint-plugin-react@7.37.5`, `eslint-plugin-jsx-a11y@6.10.2`, `eslint-plugin-import@2.32.0`-এর peer সর্বোচ্চ `eslint ^9`। এরা 10 সমর্থন করলে আপগ্রেড।
- কোথাও `--force`/`--legacy-peer-deps` ব্যবহার হয়নি।

### টুলিং ও কাঠামো

- **Tailwind v4 CSS-first:** `src/app/globals.css`-এ `@import 'tailwindcss'` ও `@theme`; `tailwind.config.js` নেই।
- **ESLint flat config** (`eslint.config.mjs`): next core-web-vitals + typescript + prettier। `src/core` থেকে `@/modules/*` import ESLint error (সেকশন ৩-এর dependency নিয়ম)।
- **TypeScript strict** + `noUncheckedIndexedAccess`, `noImplicitOverride`।
- **Backend health:** সাধারণ `fetch` (Server Component, `cache: 'no-store'`, ৩ সেকেন্ড timeout), পেজ `force-dynamic` যাতে প্রতি রিকোয়েস্টে যাচাই হয়। TanStack Query পরে আসবে।
- হোম পেজের লেখা ("Backend: চলছে/বন্ধ") এখন সরাসরি কোডে; next-intl যোগ হলে translation ফাইলে যাবে (সেকশন ২.৫)।

### npm audit

- 8টা moderate: সবই dev-only lint টুলচেইনে (`typescript-eslint` → `minimatch` ReDoS, GHSA-g3hv-75wg-m249)। npm-এর একমাত্র সমাধান `audit fix --force`, যা eslint-config-next-কে 15-এ নামাবে; তাই করা হয়নি। production bundle-এ যায় না। typescript-eslint নতুন রিলিজ এলে আবার দেখা।

### লোকালে যাচাই (macOS 12.7.6) — সম্পন্ন

ডেভেলপারের Mac-এ (macOS 12.7.6, Node 22.23.5) যাচাই করা হয়েছে:

- [x] Next.js 16.4.6-এর SWC নেটিভ বাইনারি macOS 12-এ চলে (`npm run dev` সফল)।
- [x] Tailwind 4.3.5-এর `@tailwindcss/oxide` নেটিভ বাইনারি macOS 12-এ চলে।
- [x] `npm ci` macOS-এ পরিষ্কারভাবে ইনস্টল হয় (Linux-এ তৈরি lockfile দিয়ে)।
- [x] লোকাল jesan-api-এর সাথে হোম পেজে "Backend: চলছে" দেখায়।

## ২০২৬-১১-১৬ — CI ও কাজের ধরন

- GitHub Actions `ci.yml`: PR ও `main`-এ push-এ `npm ci` → format:check → lint → type-check → build; Node ভার্সন `.nvmrc` থেকে।
- Action ভার্সন: `actions/checkout@v7.0.1`, `actions/setup-node@v7.1.0` (git tag থেকে যাচাই করা সর্বশেষ)। exact tag-এ pin।
- `permissions: contents: read` (ন্যূনতম), একই ref-এর পুরনো রান `concurrency` দিয়ে বাতিল, `NEXT_TELEMETRY_DISABLED=1`।
- কাজের ধরন CLAUDE.md-তে: প্ল্যান অনুমোদনের পর PR, CI সবুজ হলে `main`-এ squash merge।

## ২০২৬-১১-১৬ — hydration warning (ব্রাউজার এক্সটেনশন)

- `src/app/layout.tsx`-এর `<body>`-এ `suppressHydrationWarning`। কারণ: Grammarly-র মতো ব্রাউজার এক্সটেনশন React hydrate করার আগে `<body>`-তে `data-gr-ext-installed`, `data-new-gr-c-s-check-loaded` ইত্যাদি attribute বসায়, ফলে সার্ভার ও ক্লায়েন্টের HTML মেলে না। এটা আমাদের কোডের ভুল নয়।
- এই prop শুধু ওই একটা এলিমেন্টের নিজের attribute-এর অমিল চুপ করায়; children-এর বা অন্য কোনো এলিমেন্টের আসল hydration ভুল আগের মতোই warning দেবে। অন্য কোথাও এটা ব্যবহার নিষেধ।
