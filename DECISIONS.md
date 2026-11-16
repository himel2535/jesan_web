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

## ২০২৬-১১-১৬ — Git branch নিয়ম

- প্রতি কাজে `main` থেকে নতুন `claude/<কাজের-নাম>` branch; পুরনো branch পুনরায় ব্যবহার নয়, force push ও `main`-এ সরাসরি push নিষেধ। কারণ: PR #2-তে পুরনো branch পুনরায় ব্যবহার করতে গিয়ে force push লেগেছিল; নতুন branch নিলে সেটা কখনো লাগে না।

## ২০২৬-১১-১৬ — Step 3b-১: frontend-এর ভিত্তি

### নতুন প্যাকেজ (`npm view`, exact pin, সব `latest` stable; কোনো peer সতর্কতা নেই)

| প্যাকেজ                                               | ভার্সন                             | নোট                                    |
| ---------------------------------------------------- | --------------------------------- | -------------------------------------- |
| next-intl                                            | 4.15.1                            | peer: next ^16, react ^19              |
| @tanstack/react-query                                | 5.107.1                           |                                        |
| lucide-react                                         | 1.73.0                            | আইকন একটা একটা করে import (tree-shake) |
| clsx                                                 | 2.1.1                             |                                        |
| vitest                                               | 5.1.0                             | engines `^22.12`                       |
| vite / @vitejs/plugin-react                          | 8.3.8 / 6.3.0                     | vitest-এর জন্য                          |
| jsdom                                                | 31.0.1                            | engines `^22.22.2`                     |
| @testing-library/react / dom / user-event / jest-dom | 16.3.3 / 10.4.2 / 14.6.12 / 7.0.1 |                                        |
| axe-core                                             | 4.14.1                            | অ্যাক্সেসিবিলিটি টেস্ট                    |

- `engines.node` `>=22.12` থেকে `>=22.22.2`: jsdom 31-এর প্রয়োজন। ডেভেলপারের Mac-এ 22.23.5, CI-তে সর্বশেষ 22।
- TanStack devtools ও কোনো UI লাইব্রেরি নেওয়া হয়নি (bundle ছোট রাখতে, উপাদান নিজে বানানো)।

### ভাষা (next-intl)

- **URL-এ ভাষার প্রিফিক্স নেই।** ভাষা `NEXT_LOCALE` cookie-তে, সার্ভার পড়ে প্রথম HTML-এই সঠিক ভাষা। কারণ: পুরো অ্যাপ লগইনের পেছনে (SEO বা ভাষাভিত্তিক লিংক লাগে না), `/b/[slug]` route পরিষ্কার থাকে, middleware/proxy লাগে না।
- ক্রম: cookie → `Accept-Language` → ডিফল্ট **বাংলা**।
- অনুবাদ `messages/en.json` ও `messages/bn.json`, namespace অনুযায়ী (`common`, `nav`, `shell`, …; পরে প্রতি module-এর নিজস্ব)। ভুল key TypeScript error (`src/global.d.ts`); দুই ফাইলে একই key টেস্টে যাচাই; JSX-এ সরাসরি লেখা ESLint `react/jsx-no-literals` দিয়ে নিষেধ।
- ব্রাউজারে শুধু client component-এর namespace পাঠানো হয় (`src/core/i18n/client-messages.ts`), বাকিটা সার্ভারেই থাকে।
- সময় অঞ্চল সবসময় `Asia/Dhaka`।

### সংখ্যা, টাকা ও তারিখ (`src/core/i18n/format.ts`)

- বাংলা `bn-BD` (বাংলা অঙ্ক, লাখ-কোটি গ্রুপিং `১২,৩৪,৫৬৭`), ইংরেজি `en-IN` (`12,34,567`)।
- টাকা: Intl-এর নিজস্ব currency ফরম্যাট বাংলায় ৳ পরে বসায় ও ইংরেজিতে "BDT" লেখে, তাই ৳ নিজে সামনে বসানো হয়: `৳১২,৩৪,৫৬৭.৫০`, `-৳৫৭০.০০`।
- API থেকে Decimal string এলে Intl সরাসরি string ফরম্যাট করে (float-এ রূপান্তর নেই, তাই নির্ভুল)। হিসাব কখনো ব্রাউজারে নয়।

### থিম ও design token

- `light` / `dark` / `system` (ডিফল্ট `system`), `theme` cookie-তে। root layout সার্ভারে `<html data-theme>` বসায়, তাই পেজ লোডে ঝলকানি নেই। `system` হলে CSS `prefers-color-scheme` দিয়েই ঠিক হয়, JS লাগে না।
- টোকেন `src/core/theme/tokens.css`-এ, `globals.css`-এর `@theme inline` সেগুলোকে Tailwind ক্লাস বানায় (`bg-surface`, `text-fg-muted`, `shadow-card`, `rounded-card`, `text-page-title`)। উপাদান `dark:` variant ব্যবহার করে না, টোকেন বদলায়।
- রঙ সাদা-কালো (প্রপোজাল), অবস্থার জন্য success/warning/danger। প্রতিটা লেখা-পটভূমি জোড়া WCAG AA (৪.৫:১) টেস্টে যাচাই; এতে light থিমের warning `#a16207` থেকে `#854d0e` করা হয়েছে (আগে ৪.৪৮:১ ছিল)।
- **blur শুধু Card, Sidebar ও Modal-এ** (`glass` utility)। Topbar-এ blur নেই (প্রপোজালে ছিল, মালিকের তালিকায় নেই)। মোবাইল ড্রয়ার নিরেট surface: স্বচ্ছ ড্রয়ারের নিচে পেজের লেখা পড়া কঠিন হচ্ছিল।
- সাইডবার ছোট/বড় অবস্থা `sidebar` cookie-তে।

### ফন্ট

- `next/font/google`: Inter (`latin`) ও Noto Sans Bengali (`bengali`), দুটোই variable, শুধু নিজের script-এর subset। বাংলায় Noto আগে, ইংরেজিতে Inter আগে (`html[lang]` অনুযায়ী)। ফন্ট build-এর সময় নামানো হয়ে নিজের সার্ভার থেকে যায়, তাই প্রথম build/dev-এ ইন্টারনেট লাগে।

### অ্যাপের কাঠামো

- `src/app/(app)/layout.tsx` = AppShell (Sidebar, Topbar, মোবাইল ড্রয়ার)। মেনু `NavItem[]` তালিকা থেকে (পরে module manifest)। আইকন নাম হিসেবে যায় (সার্ভার→client সীমানায় component পাঠানো যায় না)।
- Modal ও ড্রয়ার নেটিভ `<dialog>` (focus trap, Esc, পেছনের অংশ inert), আলাদা লাইব্রেরি নয়।
- Pagination: প্রতি পাতায় ১০, পাতা URL-এর `?page=`-এ (সার্ভার শুধু ওই পাতা আনবে), লিংক prefetch করে না।
- ডেমো পেজ `/dev/ui` ফাইল `page.dev.tsx`: `next.config.ts`-এর `pageExtensions` production-এ `dev.tsx` বাদ দেয়, তাই production-এ সত্যিকারের 404 এবং কোড bundle-এ যায় না। (`notFound()` দিলে `loading.tsx`-এর streaming-এর কারণে HTTP 200 আসছিল।)
- `AGENTS.md` `next dev` নিজে তৈরি করে ও মুছলে আবার বানায়; তাই commit করা হয়েছে।

### API ক্লায়েন্ট ও ডেটা আনা

- `apiFetch`: `credentials: 'include'`, ৩ সেকেন্ড timeout, সব ত্রুটি `ApiError { kind, status, code, message, details }` (`{ error: {...} }` ও NestJS ডিফল্ট দুই রূপই বোঝে)। caller-এর cancel (AbortError) অপরিবর্তিত যায়।
- 401 হলে একবার `POST /auth/refresh` (একসাথে অনেক 401 হলেও refresh একটাই), তারপর একবার আবার চেষ্টা; তাতেও 401 হলে `setAuthFailureHandler`-এর handler (লগইনের ধাপে redirect বসবে)। `/auth/*` নিজে কখনো refresh করে না। refresh পথ jesan-api তৈরি হলে মিলিয়ে নিতে হবে।
- TanStack Query: `staleTime` ৩০ সেকেন্ড, window focus-এ refetch নয়, retry একবার কিন্তু 4xx-এ নয়।
- Query key: `createModuleKeys(module)` → `[module, businessId, entity, 'list'|'detail', …]`। mutation-এর পর শুধু সরাসরি প্রভাবিত key invalidate; filter ছাড়া `invalidateQueries()`/`refetchQueries()`/`resetQueries()` ESLint error।
- সাইডবার লিংকে prefetch ডিফল্ট বন্ধ; হালকা পেজে `prefetch: 'hover'` (মাউস বা কীবোর্ড ফোকাসে)। সাইডবার নিজে ডেটা আনে না।

### টেস্ট

- Vitest + Testing Library + jsdom + axe-core (রঙের কনট্রাস্ট jsdom মাপতে পারে না, তাই টোকেনের উপর আলাদা টেস্ট)। CI-তে `npm test` যোগ: format → lint → type-check → test → build।

### macOS 12.7.6-এ যাচাই বাকি (নতুন নেটিভ বাইনারি)

- [ ] next-intl 4.15.1-এর সাথে আসা `@swc/core` 1.16.x ও `@parcel/watcher` (অনুবাদ extractor-এর জন্য; অ্যাপ চালাতে লাগে না, তবে `npm ci`-তে ইনস্টল হয়)।
- [ ] Vitest/Vite 8-এর `rolldown` ও `lightningcss` darwin বাইনারি (`npm test`)।
- [ ] প্রথম `npm run dev`-এ Google Fonts থেকে Inter ও Noto Sans Bengali নামানো।
