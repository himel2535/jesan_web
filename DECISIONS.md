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

### macOS 12.7.6-এ যাচাই (নতুন নেটিভ বাইনারি) — সম্পন্ন

ডেভেলপারের Mac-এ (macOS 12.7.6, Node 22) `npm ci`, `npm test` ও `npm run dev` সফল:

- [x] next-intl 4.15.1-এর সাথে আসা `@swc/core` 1.16.x ও `@parcel/watcher` ইনস্টল হয় ও চলে।
- [x] Vitest/Vite 8-এর `rolldown` ও `lightningcss` darwin বাইনারি চলে (`npm test` সফল)।
- [x] প্রথম `npm run dev`-এ Google Fonts থেকে Inter ও Noto Sans Bengali নামে।
- [x] থিম ও ভাষা বদল এবং `/dev/ui` ঠিকমতো কাজ করে।

## ২০২৬-১১-১৭ — Step 3b-২: লগইন, সেশন, Enterprise Dashboard, ব্যবসার কাঠামো

নতুন কোনো প্যাকেজ নেই, তাই নতুন নেটিভ বাইনারিও নেই (macOS 12.7.6-এ নতুন যাচাই লাগে না)।

### সেশন ও same-site proxy (মালিকের অনুমোদিত)

- **Next.js proxy (`rewrites`)**: ব্রাউজার শুধু এই সাইটের `/api/v1/*` ডাকে; `next.config.ts` সেটা `API_INTERNAL_URL`-এ পাঠায় এবং API-র `Set-Cookie` ফেরত দেয়। তাই `jesan_at` (Path `/`) ও `jesan_rt` (Path `/api/v1/auth`) web সাইটের নামে বসে; সার্ভার পেজ-অনুরোধে `jesan_at` পায়। লোকাল ও ডিপ্লয়ে একই নিয়ম, CORS লাগে না, আলাদা domain-এও চলে। (সরাসরি `api.` সাবডোমেইনে cookie `api.` host-এ থাকত, Next সার্ভার দেখত না।)
- **`NEXT_PUBLIC_API_URL` বাদ**: ব্রাউজারের পথ সবসময় `/api/v1`; সার্ভারের পথ `API_INTERNAL_URL` (শুধু সার্ভার env)। `docs/API.md`-র উদাহরণ কোডে `NEXT_PUBLIC_API_URL` আছে; ওটা backend-এর ডকুমেন্ট, frontend এটা ব্যবহার করে না।
- **ডিপ্লয়ের শর্ত**: (১) `API_INTERNAL_URL` `next build`-এর আগে দিতে হবে (rewrites build-এ তৈরি হয়); (২) jesan-api-র `CORS_ORIGIN`-এ web সাইটের origin (হুবহু) থাকতে হবে, নইলে POST-এ 403 `Origin not allowed`; (৩) proxy-র পেছনে `APP_ORIGIN` দেওয়া ভালো।
- **সুরক্ষিত পেজ**: `src/proxy.ts` (Next 16-এ middleware-এর নতুন নাম) শুধু `jesan_at` আছে কি না দেখে, API ডাকে না; না থাকলে `/api/v1/auth/resume?next=…`। লেআউট সার্ভারে `GET /auth/me` ডাকে (React `cache`-এ প্রতি অনুরোধে একবার; অনুরোধের বাইরে cache নেই, যাতে অনুমতি বদল সঙ্গে সঙ্গে কার্যকর)। 401 → resume; API বন্ধ → লগআউট নয়, "সার্ভার বন্ধ" পেজ।
- **Resume route** (`src/app/api/v1/auth/resume/route.ts`): এই পথ `/api/v1/auth`-এর নিচে, তাই `jesan_rt` এখানে আসে। সার্ভার থেকে `POST /auth/refresh` ডাকে **স্পষ্ট `Origin` header দিয়ে** (`APP_ORIGIN`, না থাকলে `x-forwarded-host/proto` বা `Host` থেকে), কারণ সার্ভার-সাইড fetch নিজে Origin পাঠায় না আর API-র CSRF চেক তা চায়। API-র `Set-Cookie` **হুবহু** ফেরত দেয় (`relaySetCookies`; `response.cookies.set` ব্যবহার করা হয়নি কারণ সেটা সব Set-Cookie নতুন করে লিখত)। সফল → `next`, ব্যর্থ → `/login?next=…`। লুপ ঠেকাতে ১৫ সেকেন্ডের `jesan_resumed` cookie। Next-এ আসল route ফাইল rewrite-এর আগে মেলে, তাই এই পথ API-তে যায় না।
- **ব্রাউজারে 401** (`apiFetch`, docs/API.md §3): একসাথে একটাই refresh; তারপর মূল অনুরোধ একবার আবার — **refresh ব্যর্থ হলেও**, কারণ অন্য ট্যাব হয়তো ১০ সেকেন্ডের মধ্যে refresh করে নতুন cookie এনেছে। তাতেও 401 → `/login?next=বর্তমান পেজ`। শুধু `login`/`refresh`/`logout`-এ refresh নয় (আগে সব `/auth/*` বাদ ছিল, যা `/auth/me` ও `change-password`-এর জন্য ভুল ছিল; ঠিক করা হয়েছে)।
- **`next` পথ** শুধু এই সাইটের (`safeNextPath`): বাইরের সাইট, `//`, `/\`, scheme, `/login`, `/api` → `/`।
- লগইন, লগআউট ও সেশন শেষে পুরো পেজ লোড (`navigateTo`), যাতে সার্ভার নতুন cookie দেখে আর query cache মুছে যায়।

### লগইন

- ভুল তথ্য, অজানা ইউজার, নিষ্ক্রিয় ও **লক** — API সবগুলোতে একই 401 দেয়, তাই একটাই বার্তা ("…ভুল, অথবা অ্যাকাউন্ট সাময়িকভাবে বন্ধ")। লকের আলাদা বার্তা দেওয়া সম্ভব নয়।
- 429 → আলাদা বার্তা, `Retry-After`-এর সেকেন্ডসহ। নেটওয়ার্ক/timeout ও 5xx → "সার্ভার বন্ধ" (API বন্ধ থাকলে Next proxy 500 দেয়)।
- দুবার জমা ঠেকাতে ref (state-এর আগেই কাজ করে) + নিষ্ক্রিয় বাটন। ভুল হলে পাসওয়ার্ড মুছে সেখানে ফোকাস।
- লগইন পেজে backend `/health`-এর অবস্থা (আগের হোম পেজের "Backend: চলছে/বন্ধ" এখানে সরানো হয়েছে)।

### ড্যাশবোর্ড ও ব্যবসা

- Enterprise Dashboard-এর কার্ড সার্ভারে `me` থেকে (অনুরোধে আগেই আনা, বাড়তি API ডাক নেই)। কার্ড hover/focus-এ prefetch।
- `/b/[slug]`: platform owner-এর অচেনা slug → **404**; অন্যদের অচেনা বা অ্যাক্সেস নেই → একই **403** পেজ (API-র মতো, ব্যবসা আছে কি না ফাঁস হয় না)। Next-এর `forbidden()` এখনো experimental, তাই 403 পেজ নিজে render (HTTP 200)। অনুমতি ছাড়া ফিচার URL সরাসরি খুললেও 403।
- মেনু module manifest থেকে (`src/modules/dealership/manifest.ts`), অনুমতি অনুযায়ী ছাঁকা; core কোনো module import করে না, `src/modules/registry.ts` (app স্তর) ধরন → manifest মেলায়। core-এর ফোল্ডারের নাম `module-system` (ESLint-এর `**/modules/*` নিয়ম যাতে core-এর নিজের ফোল্ডারে ভুল করে না লাগে)।
- কমিশন মেনুতে `commission.view` (owner-only), রিপোর্টে `reports.finance.view` লাগে; তাই ম্যানেজার এগুলো দেখে না।
- `loading.tsx` পেজ স্তরে (লেআউট স্তরে নয়), যাতে লেআউটের 404 আসল HTTP 404 থাকে।

### অনুমতি সহায়ক

- `can`, `useCan`, `<Can>` **শুধু দেখানোর সুবিধা, সুরক্ষা নয়**। আসল যাচাই jesan-api-তে: অনুমতি না থাকলে 403, আর টাকার সংবেদনশীল ফিল্ড (কমিশন, লাভ, কেনা-দাম) response-এ পাঠায়ই না।

### UI

- ভাষা ও থিমের সুইচ টপবার থেকে ব্যবহারকারী মেনুতে; লগইন পেজে আলাদা করে আছে।
- Dropdown (ব্যবহারকারী মেনু, ব্যবসা বদল) disclosure ধাঁচে: বাটনে `aria-expanded`, ভেতরে সাধারণ লিংক-বাটন, Esc ও বাইরে ক্লিকে বন্ধ। নিরেট surface, blur নয়।
- পাসওয়ার্ড বদল: নিয়ম (১০–১২৮ অক্ষর, নিজের email/phone নয়, দুবার একই) পাঠানোর আগে যাচাই; তাই API-র 400 মানে "বর্তমান পাসওয়ার্ড ভুল"।

### যাচাই

- ইউনিট টেস্ট ১৫২টা। এছাড়া docs/API.md অনুযায়ী একটা নকল API বানিয়ে production build-এ Playwright দিয়ে পুরো প্রবাহ চালানো হয়েছে: cookie-র সব বৈশিষ্ট্য (`jesan_rt` Path `/api/v1/auth`, HttpOnly, SameSite=Lax), resume-এ `Origin: http://localhost:3000`, 401 → একটা refresh → retry, ম্যানেজারে কমিশন/রিপোর্ট নেই, 403/404, open redirect বন্ধ, API বন্ধে সঠিক বার্তা।
- `docs/API.md` `.prettierignore`-এ: এটা jesan-api-র চুক্তির হুবহু কপি, তাই frontend-এর Prettier এটা নতুন করে সাজাবে না (না হলে `format:check` ব্যর্থ হতো)।

## ২০২৬-১১-১৭ — Step 3b-৩: Settings, রোল-অনুমতির ছক, ইউজার ব্যবস্থাপনা

নতুন প্যাকেজ নেই, তাই নতুন নেটিভ বাইনারিও নেই (macOS 12.7.6-এ নতুন যাচাই লাগে না)।

### মালিকের সিদ্ধান্ত

- **ছক শুধু `roles.manage`-এর (platform owner) জন্য**, ইচ্ছাকৃত। ম্যানেজার বা অন্য কেউ (শুধু `settings.view`) ছক দেখে না, শুধু-দেখার ছকও নয়; সরাসরি `/settings/roles` খুললে 403 পেজ।
- **রোল বাছাইয়ে `owner` দেখায় না** (নতুন ইউজার ও রোল বদল): API স্পষ্টভাবে owner রোল দেওয়া অনুমোদন না করা পর্যন্ত। তালিকা `ASSIGNABLE_ROLE_KEYS` (`src/core/settings/types.ts`)।
- **"শেষ লগইন" কলাম** শুধু তখনই, যখন `GET users`-এর উত্তরে `lastLoginAt` ফিল্ড সত্যিই থাকে (`'lastLoginAt' in item`); না থাকলে কলাম নিজে থেকে বাদ যায়। docs/API.md §8-এ ফিল্ডটা আছে, তাই এখন দেখায়; আসল backend-এ না এলে সেটা ঘাটতি হিসেবে জানাতে হবে।
- **ছকে আংশিক ব্যর্থতা**: প্রতিটা বদলানো রোলের জন্য আলাদা PUT, এক এক করে। সফল রোল ও ব্যর্থ রোল (কারণসহ) আলাদা দেখায়; ব্যর্থদের বদল অসংরক্ষিত থাকে; "আবার চেষ্টা" শুধু ব্যর্থ রোলগুলো পাঠায়।
- **ব্রাউজারের Back বাটনের সীমাবদ্ধতা**: না-সংরক্ষিত বদলের সতর্কতা কাজ করে ট্যাব বন্ধ/রিলোডে (`beforeunload`) ও অ্যাপের ভেতরের লিংকে (নিজের dialog)। Next.js App Router-এ ব্রাউজারের Back/Forward আটকানোর নির্ভরযোগ্য উপায় নেই, তাই Back চাপলে বদল সতর্কতা ছাড়াই হারাতে পারে।

### API-র ঘাটতি (backend-এ আলাদা PR; frontend-এ বদলানোর জায়গা)

- **TODO ঘাটতি ১ — `GET users` item-এ `isPlatformOwner` নেই।** এখন: নিজের সারি (`me.user.id`) আগেই আটকানো (কাজের মেনু নেই); অন্য platform owner-এর সারিতে কাজ দেখায়, সার্ভার 400 দিলে dialog-এ বার্তা। ঠিক হলে: `SettingsUser`-এ `isPlatformOwner` যোগ (`src/core/settings/types.ts`), আর `users-section.tsx`-এ `isSelf`-এর মতো ওই সারিতেও `RowActions` লুকানো।
- **TODO ঘাটতি ৩ — 409-এ বিদ্যমান ইউজারের id নেই, খোঁজার endpoint নেই।** এখন: শুধু বার্তা ("এখানে এখনো নেই")। ঠিক হলে: `CreateUserDialog`-এর 409 শাখায় (`user-dialogs.tsx`) "এই ব্যবসায় যোগ করুন" বাটন, যেটা `POST users/:userId/access` ডাকবে (`api.ts`-এ নতুন `useGrantAccess`), আর `settings.users.error.duplicate` লেখা বদলাতে হবে।
- **TODO ঘাটতি ৪ — owner রোল দেওয়া যায় কি না, আর platform owner রা `GET users`-এ আসেন কি না, স্পষ্ট নয়।** এখন: owner রোল বাছাইয়ে নেই। অনুমোদন এলে: `ASSIGNABLE_ROLE_KEYS`-এ `'owner'` যোগ। platform owner তালিকায় না এলে কিছু বদলাতে হবে না।
- (ঘাটতি ২ ইচ্ছাকৃত, উপরে।) ম্যানেজার রোলের তালিকার endpoint ডাকতে পারে না বলে রোলের নাম অনুবাদ ফাইল থেকে (`settings.roleNames`, চারটা স্থির key); অজানা key এলে key-টাই দেখায়।

### কাঠামো

- Settings core-এর অংশ (প্রপোজাল ৩): `src/core/settings/`; route `src/app/(app)/b/[slug]/settings/{users,roles}` (catch-all ফিচার পেজের আগে মেলে)।
- দেখার নিয়ম (`settingsSections`, শুধু UI): Settings = `settings.view` (না থাকলে 403); ইউজার = `users.view` (তালিকা), `users.manage` থাকলে বাটন; ছক = `roles.manage`। শুধু `settings.view` (যেমন হিসাবরক্ষক) → "এখানে কিছু নেই" ফাঁকা অবস্থা। আসল সুরক্ষা API-তে।
- এই প্রথম TanStack Query: query key `['settings', businessId, 'roles']` ও `['settings', businessId, 'users', 'list', { page }]`। ছক সেভের পর শুধু `roles`, ইউজারের বদলের পর শুধু ওই ব্যবসার `users` invalidate; রিসেটে কিছুই না (তালিকা বদলায় না)। ইউজার 404 পেলে তালিকা রিফ্রেশ।
- ত্রুটির বার্তা status দেখে (`settingsErrorKind`), API-র ইংরেজি `message` দেখে নয়: 409 → ডুপ্লিকেট, 400 → সার্ভার গ্রহণ করেনি, 403 → অনুমতি নেই, 404 → পাওয়া যায়নি, 5xx/নেটওয়ার্ক → সার্ভার বন্ধ।

### ছকের UI

- ডেস্কটপ (≥768px): পুরো টেবিল, module → বিষয় (key-র প্রথম অংশ) অনুযায়ী `rowgroup`, sticky প্রথম কলাম; blur নেই। ফোন: উপরে রোল বাছাই, নিচে ওই রোলের গ্রুপ করা তালিকা (একই state)। সার্ভার ও টেস্টে ডিফল্ট ডেস্কটপ (`matchMedia` না থাকলে)।
- লেবেল `permissions.items/subjects/modules`-এ (দুই ভাষা); API-তে নতুন অচেনা key এলে key-টাই দেখায় (`useDynamicT`)। docs-এর ৩২টা অনুমতির লেবেল আছে কি না টেস্ট যাচাই করে।
- owner কলাম ও owner-only সারি নিষ্ক্রিয়; কারণ `title`-এ ও `aria-describedby`-তে।
- কীবোর্ড: সব আসল checkbox (Tab/Space), সাথে তীর দিয়ে ঘর থেকে ঘরে (নিষ্ক্রিয় ঘর বাদ দিয়ে)।
- সেভ: আগে সারাংশ (রোল অনুযায়ী যোগ/বাদ), তারপর PUT-এ সম্পূর্ণ তালিকা (API যোগ-বিয়োগ নয়, পুরো তালিকা নেয়)।

### ইউজার ও পাসওয়ার্ড

- পাসওয়ার্ডের নিয়ম এক জায়গায় (`src/core/auth/password-rules.ts`): ১০–১২৮ অক্ষর, যার পাসওয়ার্ড তার ইমেইল/ফোন নয় (রিসেট ও নতুন ইউজারে লক্ষ্য ইউজারের সাথে মেলানো)। নিজের পাসওয়ার্ড বদলের ফর্মও এটাই ব্যবহার করে।
- পাসওয়ার্ড শুধু dialog-এর সাময়িক state-এ; কখনো URL, log, query cache বা storage-এ নয়; সফল বা ব্যর্থ পাঠানোর পর ও dialog বন্ধে মুছে যায়; `autoComplete="new-password"`।
- নতুন ইউজারে শুধু পূরণ করা ফিল্ড যায় (খালি ইমেইল/ফোন নয়; API অঘোষিত ফিল্ডে 400 দেয়)। ফোন `01…`/`8801…`/`+8801…` তিন রূপই গ্রহণ (API normalize করে)।
- ঝুঁকির কাজে (অ্যাক্সেস সরানো, নিষ্ক্রিয়, রিসেট) নিশ্চিতকরণ dialog; নিষ্ক্রিয় করলে **সব ব্যবসা** থেকে লগআউট হয়, সেটা লেখা থাকে। নিষ্ক্রিয়কে আবার সক্রিয় করা যায়।
- দুবার জমা: ref-guard + নিষ্ক্রিয় বাটন।

### যাচাই

- নতুন টেস্ট ৩০টা (মোট ১৮২)। docs/API.md §8 অনুযায়ী নকল API-তে production build-এ Playwright: ছকে ম্যানেজারের অনুমতি বদল ও সেভ, কমিশন (owner-only) নিষ্ক্রিয়, না-সংরক্ষিত সতর্কতা, তীর-কী, ইউজার তৈরি (409 সহ), রোল বদল, রিসেট (নিজের ইমেইল পাসওয়ার্ড হিসেবে আটকানো), নিষ্ক্রিয়/সক্রিয়, নতুন ইউজারের লগইন, ম্যানেজারের শুধু-দেখা অবস্থা ও `/roles`-এ 403, মোবাইল ছক, আংশিক ব্যর্থতায় শুধু ব্যর্থ রোল আবার পাঠানো।
