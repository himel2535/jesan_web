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

- **(বন্ধ, Step 4e) ঘাটতি ১ — `GET users` item-এ `isPlatformOwner` নেই।** এখন: নিজের সারি (`me.user.id`) আগেই আটকানো (কাজের মেনু নেই); অন্য platform owner-এর সারিতে কাজ দেখায়, সার্ভার 400 দিলে dialog-এ বার্তা। ঠিক হলে: `SettingsUser`-এ `isPlatformOwner` যোগ (`src/core/settings/types.ts`), আর `users-section.tsx`-এ `isSelf`-এর মতো ওই সারিতেও `RowActions` লুকানো।
- **(বন্ধ, Step 4e) ঘাটতি ৩ — 409-এ বিদ্যমান ইউজারের id নেই, খোঁজার endpoint নেই।** এখন: শুধু বার্তা ("এখানে এখনো নেই")। ঠিক হলে: `CreateUserDialog`-এর 409 শাখায় (`user-dialogs.tsx`) "এই ব্যবসায় যোগ করুন" বাটন, যেটা `POST users/:userId/access` ডাকবে (`api.ts`-এ নতুন `useGrantAccess`), আর `settings.users.error.duplicate` লেখা বদলাতে হবে।
- **TODO ঘাটতি ৪ (খোলা; Step 4e-তে মালিকের সিদ্ধান্ত: এখনো যোগ নয়; doc এখন বলে platform owner `owner` রোল দিতে পারেন) — owner রোল দেওয়া যায় কি না, আর platform owner রা `GET users`-এ আসেন কি না, স্পষ্ট নয়।** এখন: owner রোল বাছাইয়ে নেই। অনুমোদন এলে: `ASSIGNABLE_ROLE_KEYS`-এ `'owner'` যোগ। platform owner তালিকায় না এলে কিছু বদলাতে হবে না।
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

## ২০২৬-১১-১৭ — Step 4c: মাস্টার ডেটা (ক্যাটাগরি, পণ্য, গ্রাহক, সরবরাহকারী)

### API চুক্তি

- এই repo-র `docs/API.md` পুরনো ছিল (মাস্টার ডেটা ছিল না)। backend `himel2535/jesan_api` main (`61bf8ed`) থেকে **হুবহু কপি** করা হয়েছে। CLAUDE.md-তে নিয়ম: প্রতিটা কাজের আগে মিলিয়ে নেওয়া।
- বাধ্যতামূলক ঘর ও সীমা backend-এর DTO (`src/modules/dealership/master-data/dto/requests.ts`) ও Prisma schema থেকে নেওয়া: নাম ১–১২০; ক্যাটাগরি ও পণ্যে `nameEn` + `nameBn` বাধ্যতামূলক, গ্রাহকে `nameBn` ঐচ্ছিক; ফোন বাধ্যতামূলক ≤২০; ঠিকানা ≤২৫৫; এলাকা ≤৮০; ক্রম ০–১০০০০; কারণ ৩–৫০০; টাকা `^\d{1,12}(\.\d{1,2})?$` (বাকিতে ঋণাত্মক চলে) = `Decimal(14,2)`। ফোনের নিয়ম backend-এর `normalizePhone` হুবহু (`src/core/lib/phone.ts`)।
- নতুন ৪টা অনুমতি (`product.price.edit`, `product.deactivate`, `customer.balance.edit`, `customer.deactivate`) — Settings-এর ছকে দুই ভাষার লেবেল যোগ।

### সিদ্ধান্ত

- পাতাগুলো ডিলারশিপ module-এ (`src/modules/dealership/master-data/`); app-এর route ফাইল পাতলা। ব্যবসার ধরন dealership না হলে 404, অনুমতি না থাকলে 403 পেজ (`dealershipPage` guard)।
- **টাকা সবসময় স্ট্রিং**: দেখানো `formatMoney(string)`; "অগ্রিম" ঠিক হয় `-` চিহ্ন দেখে; PATCH-এ "570" আর "570.00" একই কিনা স্ট্রিং তুলনায় (`sameMoney`), Number-এ রূপান্তর নেই। ইনপুটে বাংলা অঙ্ক ও কমা গ্রহণ করে স্ট্রিং হিসেবেই পাঠানো হয়।
- কেনা-দাম ও বাকি/সীমা: অনুমতি থাকলে **এবং** API ফিল্ড পাঠালে তবেই কলাম/ঘর থাকে; না হলে কলাম, header, বিস্তারিতের সারি — কিছুই নয়।
- সংবেদনশীল সংশোধন (দাম, শুরুর বাকি, ক্রেডিট সীমা) সম্পাদনা পাতার আলাদা "মালিক-স্তরের সংশোধন" অংশে: অনুমতি থাকলে বদলানো যায় এবং বদলালে কারণ বাধ্যতামূলক; না থাকলে শুধু-পড়ার। "সংশোধনের অনুরোধ"-এর জন্য `SensitiveSection`-এর `requestSlot` রাখা, এখন কিছু render হয় না (মৃত বাটন নেই)। নিষ্ক্রিয়/সক্রিয় বিস্তারিত পাতায় (ক্যাটাগরিতে তালিকায়), কারণসহ।
- তালিকার অনুসন্ধান ৩০০ms debounce, অবস্থা ও ফিল্টার URL-এ; ফিল্টার বদলালে পাতা ১। সরবরাহকারীর API-তে `search` নেই, তাই সেখানে শুধু অবস্থার ফিল্টার।
- ফোনে টেবিলের বদলে কার্ড (`useMediaQuery`; সার্ভার ও টেস্টে ডিফল্ট ডেস্কটপ)।
- query key `['dealership', businessId, entity, …]`; পণ্য বদলে শুধু `products`, ক্যাটাগরি বদলে `categories` + `products` (পণ্যের সারিতে ক্যাটাগরির নাম), গ্রাহক বদলে শুধু `customers`।
- `dealership` namespace এখন ব্রাউজারেও পাঠানো হয় (module-এর client পাতার জন্য)।

### Playwright (মালিকের সিদ্ধান্ত)

- `@playwright/test` **1.65.1** (exact), `e2e/` ফোল্ডারে; `e2e/mock-api.mjs` docs/API.md মেনে নকল API (শুধু টেস্টের অ্যাকাউন্ট ও পাসওয়ার্ড)। `npm run test:e2e` production build-এর উপর চলে (আগে `npm run build`)। CI-তে `npx playwright install --with-deps chromium` তারপর `npm run test:e2e`।
- **CI-ই মূল জায়গা; Mac-এ e2e ঐচ্ছিক।** macOS 12.7.6-এ Playwright-এর Chromium চলবে কি না যাচাই বাকি (নতুন Chrome পুরনো macOS বাদ দিচ্ছে)।
- আগে থেকে ব্রাউজার থাকা মেশিনে `PW_CHROMIUM_PATH` দিয়ে সেটা ব্যবহার করা যায় (যেমন এই ক্লাউড পরিবেশ)।

### API-র ঘাটতি (backend-এ আলাদা PR)

- **(বন্ধ, Step 4e) ঘাটতি — 400-এর উত্তরে মেশিন-পড়ার মতো `code`/`field` নেই।** এখন: সব 400 → একটাই সাধারণ বার্তা (`dealership.common.error.refused`); ক্লায়েন্ট আগেই DTO-র নিয়ম যাচাই করে, তাই সাধারণত 400 আসে না। 409 প্রতিটা ফর্মে একটাই কারণ (পণ্য/ক্যাটাগরি = নাম, গ্রাহক = ফোন), তাই ঘরে দেখানো যায়। ঠিক হলে বদলাতে হবে: `src/core/api/error-kind.ts` (field/code পড়া), আর ফর্মগুলোর catch শাখা — `products/product-form.tsx`, `customers/customer-form.tsx`, `categories/category-dialog.tsx`, `shared/deactivate-dialog.tsx` — যাতে `Category not found or inactive`, `Unknown unit`, `Phone number is not valid`, `A reason is required` নিজ নিজ ঘরে দেখায়।
- (আগের) Settings-এর `isPlatformOwner` ও `users/lookup` backend-এ এসে গেছে; frontend-এ বসানো আলাদা ছোট PR-এ হবে (এই PR-এ নয়)।
- ক্যাটাগরির `GET :id` নেই; সম্পাদনায় তালিকার ডেটা ব্যবহার — ঠিক আছে (মালিকের সিদ্ধান্ত)।

## ২০২৬-১১-১৮ — Step 4c-২: মাস্টার ডেটা সহজ ব্যবহার

### API চুক্তি

- `docs/API.md` jesan_api `main` (`5196473`, Step 4b) থেকে হুবহু কপি: §10 সংশোধনের অনুরোধ, নতুন ৪টা অনুমতি `change.request`, `change.view.own`, `change.view.all`, `change.approve`। এগুলোর লেবেল দুই ভাষায় (`permissions.items.change_*`, বিষয় `change`); টেস্টের অনুমতি-তালিকা ৪০টা। অনুরোধের UI (Step 4d) এই ধাপে নয়।

### বিস্তারিত ও কাজ মেনু

- পণ্য, গ্রাহক, ক্যাটাগরি, সরবরাহকারীর প্রতিটা সারি ও ফোনের কার্ডে দৃশ্যমান **"বিস্তারিত"** লিংক (`shared/row-actions.tsx` `DetailsLink`; screen reader-এ "‹নাম›-এর বিস্তারিত")। নামেও ক্লিক করা যায়।
- **"কাজ"** মেনু (`RowActions`, core-এর `Dropdown`): সম্পাদনা (`product.manage` / `customer.manage`), নিষ্ক্রিয়/সক্রিয় (`*.deactivate`, কারণ বাধ্যতামূলক, `DeactivateDialog`)। অনুমতি না থাকলে আইটেম থাকে না; কোনো আইটেম না থাকলে মেনুই নেই। সরবরাহকারীর সম্পাদনার API নেই, তাই শুধু বিস্তারিত।
- **মুছে ফেলার বাটন নেই (ইচ্ছাকৃত):** পণ্য/গ্রাহক/ক্যাটাগরি পুরনো বিক্রি, ক্রয়, খতিয়ান ও audit-এ যুক্ত থাকে; মুছলে হিসাব ও ইতিহাস ভাঙে। তাই শুধু নিষ্ক্রিয় করা যায় (নতুন কাজে আসে না, ইতিহাস অক্ষত)। API-তেও DELETE নেই।
- সংশোধনের অনুরোধের বাটন এখন নয় (Step 4d); `SensitiveSection`-এর `requestSlot` সেই জায়গা।
- ক্যাটাগরির নতুন বিস্তারিত পাতা `/b/[slug]/products/categories/[id]` (মালিকের সিদ্ধান্ত): ছোট তালিকা, তাই `active=all` তালিকার cache থেকে পড়ে (আলাদা `GET :id` নেই); "এই ক্যাটাগরির পণ্য" → `/products?category=<id>`; সম্পাদনা ও নিষ্ক্রিয় সেখানেও।
- পণ্যের ফর্মে ক্যাটাগরির পাশে **"নতুন ক্যাটাগরি"** (`product.manage`): ডায়ালগে তৈরি হলে সাথে সাথে বাছাই হয়, তালিকায় দেখায় (নতুন তালিকা আসার আগেও); `categories` (+ `products`) key refresh। ডায়ালগ `<form>`-এর বাইরে রাখা (form-এর ভেতর form বৈধ HTML নয়)। `CategoryDialog`-এর `onSaved` এখন তৈরি/সম্পাদিত ক্যাটাগরিও দেয়।

### বিক্রয়মূল্য

- (বন্ধ, Step 4e) backend থেকে `defaultSalePrice` সরেছে; frontend থেকেও সরানো হয়েছে।

### ভবিষ্যতের গ্রাহক ও পণ্যের প্রোফাইল (খসড়া নকশা, এখন কোড নয়)

ব্যবসার প্রবাহ: গ্রাহক আগে অর্ডার দেয় → দাম অর্ডারে ঠিক হয় → ডেলিভারি এক বা একাধিক কিস্তিতে → টাকা আগাম, বা ডেলিভারির পরে আংশিক/পুরো → বাকি থাকতে পারে। **বাকি = ডেলিভারি হওয়া মালের দাম − পাওয়া টাকা** (অর্ডার হলেই বাকি নয়; আগাম টাকা ঋণাত্মক বাকি অর্থাৎ অগ্রিম)। সব হিসাব backend-এ; UI শুধু দেখায় (টাকা স্ট্রিং, `format.ts`)।

**গ্রাহকের প্রোফাইল — ট্যাব:**

- **সারসংক্ষেপ:** যোগাযোগ, এলাকা, অবস্থা; বর্তমান বাকি/অগ্রিম, ঋণসীমা ও কতটা বাকি আছে (`customer.due.view` ও response-এ থাকলে); অপেক্ষমাণ অর্ডারের সংখ্যা ও মূল্য; শেষ ডেলিভারি ও শেষ আদায়ের তারিখ।
- **লেনদেন:** খতিয়ান (তারিখ, বিবরণ — ডেলিভারি/আদায়/সমন্বয়, ডেবিট, ক্রেডিট, চলমান বাকি), তারিখ-ফিল্টার, সার্ভার-সাইড ১০ সারি।
- **বাকি-আদায়:** আদায়ের তালিকা (তারিখ, পরিমাণ, মাধ্যম, কে নিল), "আদায় নিন" বাটন (`collection.create`), বয়স অনুযায়ী বাকি (০–৩০, ৩১–৬০, ৬০+ দিন)।
- **অর্ডার ও ডেলিভারি:** অর্ডারের তালিকা (নম্বর, তারিখ, মোট, ডেলিভারি হয়েছে/বাকি পরিমাণ, অবস্থা: অপেক্ষমাণ/আংশিক/সম্পূর্ণ/বাতিল); অর্ডার খুললে কিস্তিভিত্তিক ডেলিভারির তালিকা।
- গ্রাহক তালিকায় নতুন কলাম **"অপেক্ষমাণ অর্ডার"** (সংখ্যা, ক্লিকে ওই ট্যাব)।

**পণ্যের প্রোফাইল — ট্যাব:**

- **সারসংক্ষেপ:** কোড, ক্যাটাগরি, একক, ক্রয়মূল্য (`product.cost.view` ও response-এ থাকলে), বর্তমান স্টক, অপেক্ষমাণ অর্ডারে আটকানো পরিমাণ, পাওয়া যাবে এমন স্টক।
- **লেনদেন:** স্টকের চলাচল (ক্রয়, ডেলিভারি, সমন্বয়) ও চলমান স্টক।
- **বাকি-আদায়:** এই পণ্যের অর্ডারে মোট বাকি (শুধু সারাংশ; আদায় গ্রাহকভিত্তিক)।
- **অর্ডার ও ডেলিভারি:** এই পণ্যের অপেক্ষমাণ ও আংশিক ডেলিভারির অর্ডার।

**লাগবে এমন API (backend-এ আগে):** `GET /customers/:id/summary` (বাকি, অপেক্ষমাণ অর্ডার, শেষ তারিখ), `GET /customers/:id/ledger?from&to&page`, `GET /customers/:id/collections?page`, `GET /orders?customerId|productId&status&page` ও `GET /orders/:id` (ডেলিভারির কিস্তিসহ), `GET /products/:id/summary` (স্টক, আটকানো, পাওয়া যাবে), `GET /products/:id/stock-movements?page`; তালিকায় `pendingOrderCount` ঘর। সবই পাতাভিত্তিক ও অনুমতি অনুযায়ী লুকানো ঘর।

### যাচাই

- Vitest: বিস্তারিত লিংক, অনুমতি অনুযায়ী কাজ মেনু (salesman/manager/owner), মেনু থেকে নিষ্ক্রিয়ে কারণ বাধ্যতামূলক, কীবোর্ড (Enter/Esc, ফোকাস ফেরে), ইনলাইন ক্যাটাগরি ও স্বয়ংক্রিয় বাছাই, ক্যাটাগরির বিস্তারিত পাতা, দুই ভাষা, axe।
- Playwright: তালিকা → বিস্তারিত, কাজ মেনু থেকে কারণসহ নিষ্ক্রিয়।

## ২০২৬-১১-১৮ — Step 4e: backend-এর ত্রুটি-code, বিক্রয়মূল্য সরানো, Settings-এর বাকি TODO

### API চুক্তি

- `docs/API.md` jesan_api `main` (`881d4a9`) থেকে হুবহু কপি।
- **backend-এ ঠিক করতে হবে (মালিক জানাচ্ছেন):** অংশ ১০-এর "ত্রুটি" টেবিলের পরে পুরনো টেবিলের ৯টা সারি ভুল করে রয়ে গেছে। শুরু `---|---|---|` (হেডার ছাড়া বিভাজক), তারপর `400 | validation তালিকা, Nothing to change, …`, `403 | Access denied`, `403 | You cannot decide your own change request`, `404 | Change request not found, Record not found`, `409 | This record already has a pending change request`, `409 | This change request is already approved …`, `409 | This kind of record can no longer be changed here`, `409 | The record changed after this request was made …`। নতুন code-ভিত্তিক টেবিলই ঠিক; এই সারিগুলো মুছতে হবে। নিয়ম অনুযায়ী এখানে হুবহু কপি রাখা হয়েছে।

### বিক্রয়মূল্য

- পণ্যের তালিকা (কলাম ও ফোনের কার্ড), ফর্ম, বিস্তারিত, মালিক-স্তরের অংশ, নকল API ও টেস্ট থেকে সরানো; অনুবাদের `products.salePrice*` key মুছে ফেলা। মালিক-স্তরের অংশে এখন শুধু ক্রয়মূল্য; ক্রয়মূল্য দেখার অনুমতি (বা response-এ ঘর) না থাকলে অংশটাই নেই। নতুন পণ্য তৈরিতে শুধু ক্যাটাগরি, দুই নাম, একক, (অনুমতি থাকলে) ক্রয়মূল্য।

### ত্রুটি-code (docs/API.md §11)

- `ApiError.fieldErrors` পড়ে API-র `errors[]` (না থাকলে `field` + `code`)। `fieldErrorsOf(error)` → `{ ঘর: code }`; `useErrorMessage()` (`src/core/api/field-errors.ts`) দেয় `message(error)` আর `split(error, ঘরের তালিকা)` → ঘরের নিচের বার্তা + form-এর উপরের বার্তা।
- বার্তা বাছাই শুধু `code` দেখে, API-র ইংরেজি `message` কখনো দেখানো হয় না: (১) code-এর নিজস্ব বার্তা `apiErrors.codes.<CODE>`, (২) form-এর কাঠামোর code (`<ঘর>_<সমস্যা>`) হলে সমস্যার সাধারণ বার্তা `apiErrors.problems.<সমস্যা>`, (৩) অচেনা code হলে status অনুযায়ী `apiErrors.status.<kind>`। 429-এ অপেক্ষার বার্তা।
- code-এর তালিকা `src/core/api/error-codes.ts`-এ (§11-এর টেবিল + কয়েকটা কাঠামোর code); টেস্ট যাচাই করে প্রতিটার দুই ভাষার বার্তা আছে এবং অনুবাদে তালিকার বাইরের কিছু নেই। নতুন code এলে আগে তালিকায়, তারপর দুই অনুবাদ ফাইলে।
- নামস্থান `apiErrors` (পুরনো `errors` নামস্থান পেজের ত্রুটির জন্য, তাই আলাদা)।
- সংযোগ: গ্রাহক ফর্ম (ফোনের ডুপ্লিকেট ও অবৈধ, এবং প্রতিটা ঘর), পণ্য ফর্ম (নামের ডুপ্লিকেট, ক্যাটাগরি নেই/নিষ্ক্রিয়, অচেনা একক — এককের ঘরেও এখন বার্তা), ক্যাটাগরি ফর্ম, নিষ্ক্রিয়ের কারণের ঘর, Settings-এর নতুন ইউজার (`EMAIL_OR_PHONE_REQUIRED` ইমেইল/ফোনের দলের নিচে), রোল বদল, রিসেট (`newPassword`), ঝুঁকির কাজ, নিজের পাসওয়ার্ড বদল (`CURRENT_PASSWORD_INCORRECT`)।
- তালিকা লোডের ত্রুটি (`LoadError`) আগের মতো status দেখে (ঘর নেই, "আবার চেষ্টা" status-এর উপর নির্ভর করে)।

### Settings

- `GET users`-এর `isPlatformOwner: true` সারিতে কাজের মেনু নেই, ছোট নোট থাকে (নিজের সারির মতো)। doc অনুযায়ী এমন সারি কার্যত আসে না; তবু সুরক্ষা।
- **"বিদ্যমান ইউজার যোগ করুন"** (`users.manage`): ইমেইল/ফোন → `POST users/lookup` (body-তে) → নাম ও অবস্থা → রোল বাছাই → `POST users/:id/access`। আগে থেকে সদস্য হলে বর্তমান রোলসহ বার্তা, platform owner হলে বার্তা; দুটোতেই যোগের বাটন নেই। 404 → ঘরের নিচে "পাওয়া যায়নি"; 429 → কত সেকেন্ড পরে।
- খোঁজার ইমেইল/ফোন URL, query বা mutation cache-এ যায় না: lookup সাধারণ `apiFetch` কল (TanStack mutation নয়, কারণ mutation cache variables রেখে দেয়), dialog বন্ধে মুছে যায়। সফল যোগে শুধু ওই ব্যবসার `users` key রিফ্রেশ।
- নতুন ইউজার তৈরিতে 409 `USER_ALREADY_EXISTS` → বার্তার সাথে "বরং বিদ্যমান ইউজারকে যোগ করুন" বাটন; একই ইমেইল/ফোন দিয়ে খোঁজার dialog খোলে। native dialog-এর দেরিতে আসা `close` event যেন নতুন dialog বন্ধ না করে, তাই তৈরির dialog শুধু নিজেকে বন্ধ করে।
- রোল বাছাইয়ে `owner` এখনো নেই (মালিকের সিদ্ধান্ত, TODO ৪ খোলা)।
- "শেষ লগইন" কলাম আগে থেকেই আছে (`lastLoginAt` এলে); বদল লাগেনি।

### যাচাই

- Vitest: প্রতিটা code-এর দুই ভাষার বার্তা, `fieldErrorsOf`, অচেনা code-এ status-এর বার্তা, ঘরে/উপরে ভাগ, পণ্য (ক্যাটাগরি নিষ্ক্রিয়, অচেনা একক, বাংলায়), গ্রাহক (সার্ভারের অবৈধ ফোন), কারণের ঘর, পাসওয়ার্ড, Settings (platform owner-এর সারি, খোঁজার সব শাখা, 409 থেকে খোঁজায় যাওয়া, axe)।
- Playwright: বিক্রয়মূল্য ছাড়া নতুন পণ্য (ডুপ্লিকেট নাম ঘরের নিচে), platform owner বিদ্যমান ইউজার খুঁজে যোগ করেন। নকল API-র সব ত্রুটি এখন §11-এর রূপে।

## ২০২৬-১১-১৮ — Step 4d: অনুমোদন ইনবক্স ও সংশোধনের অনুরোধ

### স্থাপত্য

- ইনবক্স core-এ (`src/core/approvals/`), কোনো ব্যবসার নাম নেই। কোন `entityType`-এর পাতা কোথায় আর অনুমোদনের পর কোন entity key রিফ্রেশ, তা module manifest-এর `changeEntities`-এ (কেবল ডেটা, function নয়, তাই server থেকে client-এ যায়): `product` → `products/:id`, `['products']`; `customer` → `customers/:id`, `['customers']`; `product_category` → `products/categories/:id`, `['categories','products']`। layout `ChangeEntitiesProvider` দিয়ে দেয়; core কখনো module import করে না।
- query key: `[type, businessId, 'change-requests', 'list'|'detail', …]`, ব্যাজ `[…, 'change-requests', 'count']`।
- **রিফ্রেশ:** নতুন অনুরোধ, প্রত্যাখ্যান বা তুলে নেওয়ার পর শুধু `change-requests` (তালিকা, বিস্তারিত, ব্যাজ একসাথে)। অনুমোদনের পর তার সাথে manifest-এ বলা entity (রেকর্ড শুধু অনুমোদনেই বদলায়)। 409/404 এলে `change-requests` রিফ্রেশ, যাতে stale বা আগেই সিদ্ধান্ত হওয়া অবস্থা দেখায়।

### সাইডবারের ব্যাজ: "সাইডবার নিজে ডেটা আনবে না" নিয়মের সচেতন ব্যতিক্রম

- "অনুমোদন" লিংক core-এর (`withApprovalsEntry`), Settings-এর আগে; দেখায় `change.view.own` বা `change.view.all` থাকলে।
- সংখ্যা শুধু `change.view.all`-এ (`GET pending-count`): ৬০ সেকেন্ড পর পর, ট্যাব লুকানো থাকলে বন্ধ (`refetchIntervalInBackground: false`), ট্যাব আবার দেখা গেলে সঙ্গে সঙ্গে একবার (`refetchOnWindowFocus: 'always'`, `staleTime: 0`), আর প্রতিটা সিদ্ধান্ত বা নতুন অনুরোধের পরে (key invalidate)।
- কারণ: মালিকের কাছে অপেক্ষমাণ অনুরোধ চোখে পড়া জরুরি; উত্তর একটা ছোট সংখ্যা, শুধু অনুমতিধারীর জন্য, লুকানো ট্যাবে কোনো অনুরোধ নেই। অন্য কোনো সাইডবার লিংক ডেটা আনে না।

### পাতা ও আচরণ

- Route: `/approvals` (অনুমতি অনুযায়ী `all` বা `mine`-এ), `/approvals/mine` (`change.view.own`, শুধু অবস্থার ফিল্টার), `/approvals/all` (`change.view.all`, অবস্থা ও ধরন; `entityId` শুধু লিংক থেকে, চিপে দেখায় ও মোছা যায়), `/approvals/[id]`। অনুমতি ছাড়া 403 পেজ।
- তালিকা: ১০টা, মান URL-এ; সারিতে রেকর্ড + API-র `summary`, কে, কবে, অবস্থা, বিস্তারিত। কারণ শুধু বিস্তারিতে। `summary` API যেমন পাঠায় (ইংরেজি) তেমনই দেখায়: এতে দর্শকের অনুমতি অনুযায়ী মান লুকানো থাকে, UI নিজে বানালে সেই সুরক্ষা হারাত।
- বিস্তারিত: আগের ও প্রস্তাবিত মান (শুধু API যা পাঠায়; ক্রয়মূল্য বা বাকি দেখার অনুমতি না থাকলে ঘর, মান ও প্রভাবের লাইন UI-তেও নেই), কারণ, প্রভাব (`impact[]`, লেবেল `approvals.impact.<key>` অনুবাদ থেকে, অচেনা key-তে API-র লেবেল; নিষ্ক্রিয়ের নোটও অনুবাদ), সিদ্ধান্তের নোট। প্রস্তাবিত মান শুধু পড়া যায়।
- অনুমোদন: `change.approve` + অন্যের + pending + stale নয়; নোট ঐচ্ছিক (≤৫০০)। প্রত্যাখ্যান: নোট ৩–৫০০ বাধ্যতামূলক। তুলে নেওয়া: শুধু নিজের pending। নিজের অনুরোধে অনুমোদন/প্রত্যাখ্যানের বাটনই নেই (মালিক হলেও)। সব কাজে নিশ্চিতকরণ dialog ও ref-guard।
- stale (`isStale` বা 409 `STALE_REQUEST`): স্পষ্ট বার্তা ও রেকর্ডের পাতায় "নতুন করে অনুরোধ করুন" লিংক; অনুমোদন বাটন থাকে না।

### "সংশোধনের অনুরোধ"

- বাটন শুধু যার `change.request` আছে অথচ সরাসরি অনুমতি নেই (`product.price.edit`, `product.deactivate`, `customer.balance.edit`, `customer.deactivate`): মালিক কখনো দেখেন না। ঘর দেওয়া হয় শুধু যা API পাঠিয়েছে এবং ইউজার দেখতে পারেন (ক্রয়মূল্য `product.cost.view`, বাকি/সীমা `customer.due.view`)। কোথায়: পণ্য ও গ্রাহকের বিস্তারিত ও সম্পাদনার পাতার মালিক-স্তরের অংশ (`requestSlot`), ক্যাটাগরির "কাজ" মেনু ও বিস্তারিত পাতা। (`src/modules/dealership/master-data/shared/correction.tsx`)
- dialog (core, `request-dialog.tsx`): কোন ঘর বদলাবে বাছাই করে নতুন মান, বা নিষ্ক্রিয়/সক্রিয়ের অনুরোধ, আর কারণ (৩–৫০০)। "পর্যালোচনা" → `POST preview`-এর প্রভাব; মান বদলালে আবার পর্যালোচনা লাগে; তারপর "পাঠান"। টাকা স্ট্রিং।
- Idempotency-Key dialog খোলার সময় একবার (`crypto.randomUUID()`), প্রতিটা চেষ্টায় সেটাই; সাথে ref-guard। ব্যর্থ হলে লেখা মান ও কারণ থাকে।
- dialog `createPortal`-এ document.body-তে, আর submit-এ `stopPropagation`: সম্পাদনার ফর্মের ভেতরে বাটন থাকলেও form-এর ভেতর form হয় না, আর অনুরোধ পাঠাতে গিয়ে পণ্য/গ্রাহক সেভ হয় না।
- **(বন্ধ, Step 4f) TODO (backend):** 409 `CHANGE_REQUEST_PENDING_EXISTS`-এ অপেক্ষমাণ অনুরোধের id নেই। এখন: `change.view.all` থাকলে `/approvals/all?entityId=…&status=pending` লিংক; না থাকলে নিজের `mine?status=pending` প্রথম পাতা থেকে মিলিয়ে সেই অনুরোধের লিংক; তাও না মিললে শুধু বার্তা। backend id দিলে `request-dialog.tsx`-এর `findPendingLink` বাদ দিয়ে সরাসরি `/approvals/<id>`।

### যাচাই

- Vitest: অনুমতিভেদে বাটন (মালিক/ম্যানেজার/বিক্রয়কর্মী), নিজের অনুরোধে অনুমোদন নেই, stale (আগে ও 409-এ), প্রত্যাখ্যানে নোট বাধ্যতামূলক, Idempotency-Key ও দুবার জমা না হওয়া, ব্যর্থতায় মান থাকা, 409 pending-exists-এর দুই লিংক, ব্যাজ (৬০ সেকেন্ড, লুকানো ট্যাবে বন্ধ, দেখা গেলে সঙ্গে সঙ্গে), ঠিক key-ই invalidate, লুকানো ঘর, ফাঁকা বনাম কিছু মেলেনি, 403/404, দুই ভাষা, axe, কীবোর্ড।
- Playwright (দুটো আলাদা browser context): ম্যানেজার নিষ্ক্রিয়ের অনুরোধ পাঠান → মালিক ব্যাজে ১ দেখে অনুমোদন → পণ্য নিষ্ক্রিয়, ম্যানেজারের তালিকায় "অনুমোদিত"; প্রত্যাখ্যানে নোট; মালিক সরাসরি বদলালে অনুরোধ stale। নকল API-তে change-requests (preview, idempotency, mine/all/count, approve/reject/cancel, stale, নিজের সিদ্ধান্ত নিষেধ, লুকানো ঘর)।

## ২০২৬-১১-১৮ — Step 4f: শুধু-পড়া শেষ কেনা-দাম (প্ল্যান: `docs/plans/step-4f.md`)

- `docs/API.md` jesan_api `main` (`347f37b`, #12) থেকে হুবহু কপি।
- **পণ্যে হাতে বসানো কেনা-দাম নেই।** `purchasePrice` সরানো; বদলে শুধু-পড়া `lastPurchasePrice` ও `lastPurchasedAt`। এগুলো কেনা (Step 5a) থেকে আসে, UI-তে কোনো হিসাব হয় না।
  - তালিকা ও ফোনের কার্ড: কলাম "শেষ কেনা-দাম", `null` হলে "—"।
  - বিস্তারিত: দাম ও তারিখ, `null` হলে "এখনো কেনা হয়নি"।
  - শর্ত `product.cost.view` **এবং** response-এ ঘর থাকা; না হলে জায়গাও নেই।
- পণ্যের তৈরি ও সম্পাদনায় কোনো দামের ঘর নেই; সম্পাদনায় শুধু নাম, ক্যাটাগরি, একক। সক্রিয়/নিষ্ক্রিয় আগের মতো বিস্তারিত পাতা ও "কাজ" মেনুতে।
- `product.price.edit` অনুমতি নেই (মোট ৩৯টা; লেবেল ও টেস্ট-তালিকা থেকে সরানো)। পণ্যের সংশোধনের অনুরোধে এখন শুধু নিষ্ক্রিয়/সক্রিয়।
- নতুন ত্রুটি-code `PURCHASE_PRICE_NOT_ALLOWED`, `LAST_PURCHASE_PRICE_NOT_ALLOWED` (দুই ভাষা); `PURCHASE_PRICE_INVALID` তালিকা থেকে বাদ (আর আসে না)।
- 409 `CHANGE_REQUEST_PENDING_EXISTS`-এ `changeRequestId` এলে সরাসরি `/approvals/<id>` লিংক। না এলে আগের মতো: `change.view.all` থাকলে ফিল্টার করা তালিকা, নইলে নিজের অপেক্ষমাণ অনুরোধ মিলিয়ে, তাও না মিললে শুধু বার্তা।
  - id পড়তে `ApiError.body` যোগ হয়েছে, এতে পার্স করা error body থাকে।
- অনুমোদনের core টেস্টগুলোর উদাহরণ এখন গ্রাহকের ঋণসীমা (API doc-এর মতো)।

## ২০২৬-১১-১৯ — Step 5a-c: কেনা ও স্টকের পাতা (প্ল্যান: `docs/plans/step-5a-c.md`)

মালিক অনুপস্থিত থাকায় স্বয়ংক্রিয় মোডে করা। পর্যালোচনার সিদ্ধান্তগুলো প্ল্যান ফাইলের "স্বয়ংক্রিয় সিদ্ধান্ত: পর্যালোচনা দরকার" অংশে।

- `docs/API.md` jesan_api `main` (`e8cd126`) থেকে হুবহু কপি। অংশ ১০ এখন কেনা ও স্টক, ১১ অনুরোধ, ১২ ত্রুটি, ১৩ রোল।
- অনুমতি ৪১টা (`purchase.edit`, `stock.adjust.large`)। নতুন ১৫টা ত্রুটি-code দুই ভাষায়।
- অনুরোধে লেখা `ADJUSTMENT_NEEDS_APPROVAL` docs-এ নেই; docs-এর `ADJUSTMENT_APPROVAL_REQUIRED` (403, `details.limit`, `usedToday`) ধরা হয়েছে।
- **কেনা** (`src/modules/dealership/purchases/`):
  - তালিকা: ফিল্টার URL-এ; মোট টাকা উত্তরে থাকলে তবেই।
  - নতুন কেনা: `purchase.create` + `product.cost.view`; সরবরাহকারী ডিফল্ট প্রিন্সিপাল, ডেটা থেকে; পণ্য খুঁজে লাইন যোগ; ১–৫০ লাইন; Idempotency-Key + ref-guard; ব্যর্থ হলে মান থাকে।
  - বিস্তারিত: দাম ও লাইন-মোটের কলাম শুধু উত্তরে থাকলে।
- **লাইন-মোট ও মোট** ফর্মে শুধু দেখানোর জন্য: `multiplyMoney`/`sumMoney` (`core/lib/money.ts`), BigInt-এ দশমিক-স্ট্রিং, half up দুই দশমিক। Number-এ কোনো হিসাব নয়; সেভের পর সার্ভারের মানই দেখায়। পরিমাণ `core/lib/quantity.ts` (এককের `decimals`)।
- **বাতিল ও সংশোধন:**
  - সরাসরি: বাতিল `purchase.void`; তারিখ ও বস্তা `purchase.edit`; দাম `purchase.edit` + `product.cost.view`; নোট ও কাগজের নম্বর `purchase.create`।
  - অনুরোধ: যা সরাসরি করা যায় না তা একটা "সংশোধনের অনুরোধ" বাটনে (বাতিল = `kind: void`; লাইন = `items.<id>.quantity` / `unitPrice`)।
  - `STOCK_INSUFFICIENT`-এ `details.available` থেকে "আছে মাত্র …"।
- **core request dialog বাড়ানো:** ঘরের ধরন `quantity`, `signedQuantity`, `date`, `text`; ঘরের `label`; `voidable` (বাতিলের অনুরোধ); `initial` (আগে বসানো মান ও কারণ)। সাধারণ, কোনো ব্যবসার নাম নেই।
- **স্টক** (`src/modules/dealership/stock/`):
  - তালিকায় পরিমাণ সবাই দেখেন; শেষ কেনা-দাম ও তারিখ শুধু উত্তরে থাকলে।
  - ইতিহাসে চিহ্নসহ পরিবর্তন, পরের স্টক, উৎস (কেনার লিংক), কারণ।
  - সমন্বয় dialog: সীমা পার হলে একই মান ও কারণে `product_stock` অনুরোধ (`adjustBy`)। সমন্বয়ের পর শুধু `stock` রিফ্রেশ; কেনা বদলালে `purchases`, `stock`, `products`।
- **পণ্যের পাতায় স্টক:**
  - তালিকায় `GET stock` একই ফিল্টারে (backend-এ একই ক্রম ও খোঁজা, id দিয়ে মেলানো), শুধু `stock.view`-এ। **TODO (backend):** `GET products`-এ `currentStock` দিলে বাড়তি অনুরোধ বাদ দিয়ে `products-list.tsx`-এর `useStock` সরানো।
  - বিস্তারিতে movements-এর প্রথম পাতা থেকে বর্তমান স্টক, সাথে ইতিহাসের লিংক।
- **ইনবক্স:**
  - `changeEntities`-এ `purchase` (`purchases/:id`; `purchases`, `stock`, `products`) ও `product_stock` (`stock/:id`; `stock`)।
  - মানের ধরন ঘরের নাম থেকে (`kindOfField`, `kindOfImpact`): বস্তা পরিমাণ হিসেবে, তারিখ তারিখ হিসেবে, টাকা টাকা হিসেবে।
  - id-যুক্ত প্রভাবের key (`stock.<id>`, `lastPurchasePrice.<id>`, `purchaseCounter.<মাস>`) prefix দিয়ে অনুবাদ, পরিচয় API-র লেবেলের শেষ শব্দ থেকে।
  - `items.<id>.*` ঘর "লাইনের পরিমাণ · …শেষ ৪ অক্ষর"। API লাইনের পণ্যের নাম দেয় না; প্রভাবের স্টক-লাইনে পণ্যের কোড থাকে।
- কমিশন ও কেনার কাউন্টার (`purchase-counters`) এই ধাপে নয় (Step 7c)।

## ২০২৬-১১-১৯ — Mac dev-এর Turbopack ক্যাশ (`docs/plans/mac-dev-cache.md`)

- **কারণ:** dev-এর স্থায়ী Turbopack ক্যাশ (`.next/dev/cache/turbopack`) `npm ci`, Next বা Node বদলের পর পুরনো module-পথ ধরে রাখে, তাই `Cannot find module 'tapable'` (Tailwind PostCSS-এর transitive dependency) বা `@vercel/turbopack/postcss`।
- **সমাধান:**
  - `predev` (`scripts/dev-cache-guard.mjs`): lockfile, Next, Node, OS বা CPU বদলালে শুধু `.next/dev` মোছে।
  - `dev:clean`: জোর করে মুছে চালায়।
  - `dev:webpack`: শেষ উপায়।
- build, CI, Vercel ও `next.config.ts` অপরিবর্তিত। dev ডিফল্ট Turbopack-ই থাকল, যাতে dev ও production একই bundler-এ চলে।

## ২০২৬-১১-১৯ — Step 5b-c: অর্ডার, ডেলিভারি, আদায় ও গ্রাহকের খাতা (প্ল্যান: `docs/plans/step-5b-c.md`)

মালিক অনুপস্থিত থাকায় স্বয়ংক্রিয় মোডে করা। পর্যালোচনার সিদ্ধান্তগুলো প্ল্যান ফাইলের "স্বয়ংক্রিয় সিদ্ধান্ত" অংশে।

- `docs/API.md` jesan_api `main` (`feec536`) থেকে হুবহু কপি। অংশ ১১ = অর্ডার, ডেলিভারি ও আদায়; ১২ = অনুরোধ; ১৩ = ত্রুটি; ১৪ = রোল।
- অনুমতি ৪১ → ৫০ (`sale.edit`, `delivery.view/create/edit/void`, `delivery.credit.override`, `collection.view/edit/void`)। নতুন ২৯টা ত্রুটি-code দুই ভাষায়।
- **নতুন পাতা** (`src/modules/dealership/sales/`): অর্ডার (`/sales`), ডেলিভারি (`/deliveries`), আদায় (`/collections`), গ্রাহকের খাতা ও ইতিহাস (`/customers/[id]/ledger`, `/activity`)। manifest-এ দুটো নতুন মেনু (`deliveries`, `collections`) আর তিনটা `changeEntities` (`sales_order`, `delivery`, `collection`)।
- **অর্ডার:** দাম প্রতি লাইনে; কেনা-দামের সঙ্গে কোনো তুলনা বা সতর্কতা নয়। অগ্রিম একই ফর্মে, কিন্তু **দুই কলে** (API-তে একসাথে পাঠানোর পথ নেই): আদায় ব্যর্থ হলে অর্ডার টেকে আর বিস্তারিত পাতায় কারণসহ "আদায় নিন" লিংক দেখায় — টাকা দুবার বসার চেয়ে নিরাপদ।
- **ডেলিভারি:** আংশিক চলে (ফাঁকা লাইন বাদ); `details` থাকা তিন ত্রুটি আসল সংখ্যাসহ লাইনের নিচে — `DELIVERY_QUANTITY_TOO_LARGE` (`remaining`), `STOCK_INSUFFICIENT` (`available`), `CREDIT_LIMIT_EXCEEDED` (`creditLimit`, `balanceAfter`)। `creditLimitExceeded` সতর্কবার্তা শুধু উত্তরে ফিল্ডটা থাকলে।
- **আদায়:** পদ্ধতি `GET collection-methods` থেকে; কোডে কোনো পদ্ধতির নাম নেই, অনুবাদ না থাকলে key নিজেই দেখায় (`useMethodLabel` + `useDynamicT`)। অর্ডার শুধু রেফারেন্স, বরাদ্দ নয়। নিষ্ক্রিয় গ্রাহকও আদায় ও ডেলিভারি পান (`active: 'all'`), নতুন অর্ডার নয়।
- **খাতা:** সারিতে "চলমান ব্যালেন্স" কলাম **নেই** — backend-এ `balance_after` নেই (step-5b সিদ্ধান্ত ২), শুরুর বাকি সংশোধনে পুরনো সংখ্যা ভুল হতো। সারাংশে এখনকার ব্যালেন্স; ঋণাত্মক মানে "অগ্রিম" ব্যাজ। frontend কোনো হিসাব করে না।
- **invalidate:** অর্ডার তৈরি → `orders`, `customers`; অর্ডার সংশোধন/বাতিল → `orders`, `deliveries`, `customers`, `ledger`; ডেলিভারি → `deliveries`, `orders`, `stock`, `customers`, `ledger`; আদায় → `collections`, `customers`, `ledger`। `products` কখনো নয়।
- **গতি:** প্রতিটা পাতায় একটাই পাতার আকারের skeleton (`sales/skeletons.tsx`); তালিকায় `keepPreviousData`; সারিতে hover/focus-এ `router.prefetch`; অর্ডারের তালিকা idle-এ `sales/new` prefetch করে; ডাবল-সাবমিট `inFlight` ref + `disabled`-এ বন্ধ।
- **একক:** এককের নাম সবসময় `GET product-units` থেকে, অনুবাদে `{unit}` প্যারামিটার। পুরনো যেসব বার্তায় "বস্তা" হার্ডকোড ছিল (`QUANTITY_INVALID`, `ADJUST_BY_INVALID`, কেনার বাতিল ও সংশোধন, স্টক সমন্বয়, `purchase.edit`-এর লেবেল, `purchaseCounter`) সেগুলো একক-নিরপেক্ষ করা হয়েছে।
- **পরিমাণের তুলনা** (`moreThan`, `delivery-form.tsx`) দশমিক-স্ট্রিং-এ অঙ্ক ধরে; Number-এ কোনো হিসাব নয়।
- **টেস্ট:** ৪৮টা নতুন unit টেস্ট; প্রতিটা ফর্ম দুটো একক-fixture-এ চলে — `bag` (decimals 0) আর শুধু-টেস্টের `tonne` (decimals 3)। নতুন e2e `e2e/sales.spec.ts` (৬টা প্রবাহ) আর mock-API-তে অর্ডার, ডেলিভারি, আদায়, খাতা ও তিনটা নতুন অনুরোধ-ধরন।
- mock-API-র `currentBalance` এখন সবসময় `openingBalance + delivered − collected`; তাই পুরনো e2e-র বেমানান ১২,৫০,০০০ ধরে নেওয়া বাদ।
- `docs/adding-a-business.md` রেপোতে ছিল না; এই PR-এ frontend অনুচ্ছেদ দিয়ে তৈরি।
- দৈনিক সারাংশ, Accounts, কমিশন, রিপোর্ট ও ছাপার কাগজ এই ধাপে নয়।

## ২০২৬-১১-২০ — লোডিং: একটাই skeleton, ঝিলিক নেই (প্ল্যান: docs/plans/loading-fix.md)

- Branch `claude/loving-gauss-htrtz5` (এই পরিবেশে push শুধু এখানেই অনুমোদিত, তাই CLAUDE.md-র "প্রতিটা কাজে নতুন নামের branch" এবার মানা যায়নি)।
- **route-এর `loading.tsx` পুরোপুরি বাদ** (দুটোই: `(enterprise)` ও `b/[slug]`), `null` দিয়ে নয়। কারণ: `loading.tsx` একটা Suspense সীমানা, তাই নিচের পাতাটা unmount হয় — `?page=`/ফিল্টার বদলালে তালিকার সারি মুছে যেত আর ব্যবহারকারী একই ক্লিকে দুইবার আকার বদল দেখত (fallback, তারপর পাতার নিজের skeleton)। সীমানা না থাকলে পরের পাতা তৈরি হওয়া পর্যন্ত আগের পাতাই থাকে, প্রতিটা পাতায় ঠিক একটা skeleton, আর `keepPreviousData` পুরনো সারি মুছে না ফেলে শুধু আবছা করে। `src/core/ui/loading-shape.test.tsx` পাহারা দেয় যে `src/app/**/loading.tsx` আর ফিরে না আসে।
- ক্লিকের উত্তর এখন `<RouteProgress>` — `useLinkStatus()`-চালিত ২px CSS বার, `<Link>`-এর ভেতরে (সাইডবারের লিংক ও `<Pagination>`-এ)। কোনো লাইব্রেরি নয়, blur নয়, `prefers-reduced-motion`-এ animation বন্ধ।
- `ListSkeleton` (টুলবার + ১০ সারি), `DetailSkeleton`, `FormSkeleton` এখন core-এ এক জায়গায় (`src/core/ui/skeleton.tsx`); `master-data/shared/states.tsx`-এর দ্বিতীয় ৫-সারির সংজ্ঞা বাদ, `sales/skeletons.tsx` শুধু re-export। বিস্তারিত পাতা `DetailSkeleton`, ফর্ম `FormSkeleton`, তালিকা ১০ সারি। Settings-এর ইউজার তালিকা ও Approvals-এর ইনবক্স হাতে লেখা skeleton ছেড়ে `ListSkeleton`-এ; Approvals-এর বিস্তারিত পাতায় server-rendered হেডার নেই, তাই `DetailSkeleton`।
- গ্রাহকের "ইতিহাস" পাতায় দুটো অংশের দুটো skeleton ছিল → পাতার জন্য একটাই (`loading` ফ্ল্যাগ)।
- `DEFAULT_TIMEOUT_MS` ৩০০০ → ১০০০০। ঘুম-ভাঙা Render ৩ সেকেন্ডে কখনো উত্তর দেয় না, তাই retry-ও বৃথা হতো; সুস্থ সার্ভারে কিছু বদলায় না (উত্তর মিলিসেকেন্ডে)।
- retry-নীতি: non-`ApiError` (অর্থাৎ বাতিল করা অনুরোধ) কখনো নয়; 4xx কখনো নয়; network/timeout/502/503/504 সর্বোচ্চ ৩ বার, বিরতি ১s → ২s → ৪s (সর্বোচ্চ ৮s); অন্য 5xx আগের মতো ১ বার।
- "সার্ভার জাগছে" বার্তা একটাই জায়গায়: `src/core/ui/waking-notice.tsx` query cache-এ subscribe করে (`fetchFailureCount > 0` অবস্থায় fetch চলছে কি না) আর `AppShell`-এ `<main>`-এর উপরে বসে, তাই কোনো পাতায় আলাদা কোড নেই। দুই ভাষায় একটাই নতুন key: `common.serverWaking`।
- Login-এ শুধু `unavailable` ত্রুটিতে পাসওয়ার্ড মুছে যায় না আর alert-এ "আবার চেষ্টা করুন" বাটন (একই মান আবার পাঠায়); বাকি সব ত্রুটিতে আগের মতোই পাসওয়ার্ড মুছে যায়।
- সাইডবারে hover/focus-এ রুট + ওই পাতার প্রথম তালিকা-query prefetch। "সাইডবার নিজে ডেটা আনে না" নিয়মের সীমিত ব্যতিক্রম: শুধু hover/focus-এ, শুধু হালকা তালিকা-পাতায় (products, customers, suppliers, purchases, sales, deliveries, collections, stock), একটা request। manifest-এ শুধু ডেটা (`listPrefetch: { entity, path, params }`), কারণ server layout client-এ ফাংশন পাঠাতে পারে না; core তাই ব্যবসা-নিরপেক্ষ থাকে। `nav-prefetch.test.ts` প্রতিটা entry-র key পাতার hook-এর key-র সঙ্গে মিলিয়ে দেখে — নইলে prefetch অন্য key-তে পড়ত আর দুইবার fetch হতো।
- `useCategories`-এ `staleTime: 5 * 60_000` (units ও collection-methods-এর মতো): products-list, stock-list, categories-panel ও product-form একই ডেটা চায়।
- ফর্ম-পাতার picker-এর তালিকা এখন পাতার প্রথম ঢেউয়েই যায় (`useWarmCustomerPicker`, `useWarmProductPicker`, আর `product-edit`-এ `useCategories`+`useUnits`)। আগে skeleton-গেট খোলার পরে picker mount হয়ে দ্বিতীয় round trip লাগত; request সংখ্যা একই, শুধু একটা RTT কম।
- টাকা/স্টক/ব্যালেন্সের invalidate সেট ও staleTime অপরিবর্তিত; default staleTime আগের মতোই ৩০ সেকেন্ড, `refetchOnWindowFocus` আগের মতোই বন্ধ।
- mock-API-তে টেস্ট-only বিলম্ব: `POST /__test/delay { ms, paths }`। cookie দিয়ে হয়নি, কারণ পাতার server অংশ (`serverApiGet`) শুধু access cookie পাঠায়, তাই `GET /auth/me` ধীর করা যেত না — অথচ route fallback ঠিক ওটারই অপেক্ষা করে।
- **backend লাগবে (এখন করা হয়নি):**
  - products-list এখনো একই ফিল্টারে আলাদা `GET stock` ডাকে শুধু স্টকের কলামের জন্য (৪ → ৩ হতো, যদি `GET products` উত্তরে স্টক থাকত)।
  - `/sales/new`-এ units + collection-methods + customers + products — চারটা; একটা সংমিশ্রিত endpoint হলে ১-২ হতো।
  - units + categories + collection-methods একবারে দেওয়ার মতো `GET /b/:slug/bootstrap` ধরনের endpoint হলে প্রায় সব পাতা এক request কমত।
  - সাইডবারের অপেক্ষমাণ-সংখ্যার ব্যাজ প্রতিটা পাতায় একটা request যোগ করে (ঘোষিত ব্যতিক্রম); `/auth/me`-র উত্তরে সংখ্যাটা থাকলে ওটা বাদ যেত।

## ২০২৬-১১-২০ — Step 6-c1: খরচ ও ক্যাশ বই (প্ল্যান: `docs/plans/step-6-c1.md`)

- `docs/API.md` backend main (`db763ee`) থেকে হুবহু sync করা হয়েছে (নতুন অধ্যায় ১৩, ত্রুটি ও রোলের অধ্যায় ১৪→১৩, ১৫→১৪ থেকে পুনর্বিন্যাস)। এই ধাপে শুধু খরচ ও ক্যাশ বই বানানো হয়েছে; রিপোর্ট ও দৈনিক সারাংশ (একই অধ্যায়ের বাকি অংশ) পরের ধাপে।
- **Manifest nav**: নতুন `expenses` (`expense.view`) ও `cashbook` (`cashbook.view`) আইটেম `stock`-এর পরে, বিদ্যমান `accounts` placeholder-এর আগে বসানো হয়েছে। `accounts` (permission `ledger.view`) touch করা হয়নি — প্রপোজাল §৭.৮-এর ভবিষ্যতের সম্মিলিত হিসাব পাতার জন্য সংরক্ষিত, এই ধাপের `expense.*`/`cashbook.view`-এর থেকে আলাদা অনুমতি ও সুযোগ।
- `cashbook` nav আইটেমে `listPrefetch` নেই: ক্যাশ বইয়ের ডিফল্ট তারিখ-সীমা ("এই মাস") সার্ভারের হিসাব, hover-এ সঠিক key মেলানো যায় না বলে prefetch বাদ (গ্রাহকের খাতা পাতার মতোই)।
- `test/fixtures/me.ts`: manager পান `expense.view/create/category.manage`, `cashbook.view`; owner সব পাঁচটা নতুন অনুমতি পান (`expense.edit`/`expense.void` manager পান না — backend-এ ডিফল্ট owner-level)। `test/settings-utils.tsx`-এর accountant fixture-এ `expense.view`, `cashbook.view` যোগ হয়েছে।
- **সংশোধনের অনুরোধে `categoryId` বাদ**: backend `change-requests`-এ `entityType: "expense"`-এর `categoryId` ফিল্ড অনুমতি দেয়, কিন্তু কোর request-dialog-এ কোনো "ক্যাটাগরি বাছাই" input-টাইপ নেই (শুধু money/quantity/date/text), আর raw id টাইপ করানো খারাপ UX। তাই request-এ `expenseDate`, `method`, `amount`, `note`, `proofNote` — পাঁচটা ফিল্ড; `categoryId` বদলাতে `expense.edit` থাকা কাউকে বলতে হবে (সরাসরি PATCH)। (`src/modules/dealership/expenses/correction.tsx`)
- Query-key entity নাম: `expenses`, `expenseCategories`, `expenseMethods`, `cashBook` (camelCase, বিদ্যমান `collections`/`stock` প্যাটার্নের সাথে সামঞ্জস্যপূর্ণ, কোনো হাইফেন নয়)। `changeEntities`: `expense → invalidate ['expenses','cashBook']`, `expense_category → invalidate ['expenseCategories','expenses']`।
- খরচের ধরন ব্যবস্থাপনা পুরোপুরি `master-data/categories`-এর প্যাটার্ন থেকে পোর্ট করা (তালিকা পাতাভাগ ছাড়া, dialog দিয়ে তৈরি/বদল, `RowActions`-এ deactivate+reason, কোনো hard delete নেই) — নতুন কোনো UI primitive লাগেনি।
- e2e mock-এ ক্যাশ বই সার্ভার-পাশে গণনা করা (কোনো টেবিল নয়; active আদায়/খরচ/কেনা থেকে সরাসরি, backend-এর বর্ণনার মতোই); কেনা সবসময় নগদ ধরা হয়েছে (মক-এ `paymentMethod` আগে থেকেই সবসময় `'cash'`)।
- পারফরম্যান্স (রিপোর্ট): খরচের তালিকা পাতা খোলায় ১টা list GET + (অনুমতি থাকলে) ১টা categories GET + ১টা methods GET = সর্বোচ্চ ৩টা; নতুন খরচের ফর্মে categories+methods = ২টা; বিস্তারিত পাতায় ১টা; ক্যাশ বইয়ে ১টা; খরচের ধরন ব্যবস্থাপনায় ১টা।

## ২০২৬-১১-২০ — Step 6-c2: রিপোর্ট ও দৈনিক সারাংশ (প্ল্যান: `docs/plans/step-6-c2.md`)

- `docs/API.md` backend main (`himel2535/jesan_api@db763ee`) থেকে `diff` করে হুবহু মিলেছে — কোনো sync লাগেনি।
- **`report.view` vs `reports.finance.view`**: রিপোর্টের ৭টা endpoint-ই (sales/collections/dues/stock/stock-movements/expenses/daily-summary) `report.view` চায় (docs/API.md §১৩, ৮ — manager ও accountant পান, salesman নয়)। Manifest-এর বিদ্যমান `reports` nav entry (`reports.finance.view`, owner-only ভবিষ্যতের লাভ/কমিশন পাতার জন্য সংরক্ষিত) touch করা হয়নি, task-এর নির্দেশমতো। ফল: manager/accountant সাইডবারে "Reports" দেখেন না কিন্তু `/reports/*` URL সরাসরি খুললে ঠিকই খোলে (route guard আসল `report.view` দেখে) — এটা জানা nav-visibility ফাঁক, এই ধাপে ঠিক করা হয়নি।
- `test/fixtures/me.ts` (OWNER/MANAGER_PERMISSIONS), `test/settings-utils.tsx` (`ALL`), `e2e/mock-api.mjs` (`MANAGER`)-এ `report.view` যোগ হয়েছে; accountant-এর ইনলাইন অনুমতি-তালিকা (যেটায় আগে থেকেই `cashbook.view`/`expense.view`-ও নেই) touch করা হয়নি — Step 6-c1-এর বিদ্যমান ফাঁক, এই ধাপের scope-এর বাইরে।
- **backend DTO যাচাই** (`jesan-api/src/modules/dealership/reports/dto/{requests,responses}.ts` পড়ে, কারণ docs/API.md §১৩-র টেবিল সংক্ষিপ্ত): `stock-movements`-এর row-এ `id` নয়, `productId` (আর `unitKey` আছে, যা brief-এ ছিল না); `stock`-এর row-এ `isActive` আছে (backend `where: {isActive: true}` দিয়ে ফিল্টার করে বলে সবসময় `true` — তাই UI-তে আলাদা কলাম দেখানো হয়নি, শুধু type-এ রাখা হয়েছে সত্যনিষ্ঠার জন্য)।
- **groupBy-ভিত্তিক label** (backend service পড়ে): `date` গ্রুপে `key`/`label` কাঁচা `YYYY-MM-DD`, তাই `useBusinessDay()` দিয়ে localize করা হয়; customer/product/category/month গ্রুপে `label` backend-এর বানানো ইংরেজি-শুধু স্ট্রিং (`"CODE NameEn"` বা শুধু `nameEn`/`"YYYY-MM"`) — সরাসরি দেখানো হয়, বাড়তি lookup বা client-side localization নয় (তাতে request-বাজেট ভাঙত)। `collections`-এর `method` গ্রুপে label-ই নেই, `key`-কে `useMethodLabel()` (sales/shared, `dealership.sales.collections.methodNames.*`) দিয়ে লেবেল করা হয় — expenses/shared-এর আলাদা `useMethodLabel` (cash-book-এর) থেকে ভিন্ন, এখানে ব্যবহার করা হয়নি।
- `stock-movements`-এর `kind` (Prisma schema comment: `purchase/purchase_edit/purchase_void/adjustment/delivery/delivery_edit/delivery_void`) ব্যবসার কনফিগারযোগ্য ডেটা নয়, backend-এর বদ্ধ তালিকা — তাই সব কটার real অনুবাদ যোগ হয়েছে (`dealership.reports.stockMovements.kind.*`), `useDynamicT` fallback-সহ (ভবিষ্যতে backend নতুন kind যোগ করলে পাতা ভাঙবে না)।
- **Dashboard**: `src/app/(app)/b/[slug]/page.tsx` এখনো generic/সব-ব্যবসার-ধরনের server page (dealership-only নয়), তাই `dealershipPage()` ব্যবহার না করে সরাসরি `can(permissions,'report.view') && business.type === dealershipManifest.type` চেক করে `DashboardView` বা বিদ্যমান `EmptyState` দেখানো হয়। নগদের ৩টা কার্ড `cashbook.view` অনুমতি আলাদা করে চেক না করে শুধু response-এ `cash` ফিল্ড আছে কিনা দেখে (API নিজেই বাদ দেয়; master-data-র "অনুমতি + ফিল্ড দুটোই থাকলে তবেই" নিয়মের মতোই)।
- Query-key entity নাম: `reportsSales`, `reportsCollections`, `reportsDues`, `reportsStock`, `reportsStockMovements`, `reportsExpenses`, `dailySummary` — `dealershipKeys` পুনর্ব্যবহার করা হয়েছে (`createModuleKeys` নতুন করে ডাকা হয়নি)।
- রিপোর্ট ও দৈনিক সারাংশ শুধু-পড়া বলে কোনো `changeEntities` entry লাগেনি; মিউটেশন/invalidation নেই।
- `reports/shared.tsx` নতুন কোড লেখেনি যেখানে `expenses/shared.tsx`-এরটাই যথেষ্ট ছিল — `dateParam`/`useBusinessDay`/`useSetFilters` re-export করা হয়েছে (cash-book-এর মতোই), শুধু `groupByParam` আর `useKindLabel` নতুন।
- সব ৬টা রিপোর্ট পাতা cash-book-view-এর প্যাটার্ন অনুসরণ করে (শুধু `overflow-x-auto` টেবিল, desktop/mobile card split নয়) — কারণ এগুলো শুধু-পড়া, expenses-list-এর মতো action-ভারী তালিকা নয়।
- e2e mock-এ dues-এর aging FIFO না করে পুরো বাকিটা `d0To7`-এ বসানো হয়েছে (সরলীকৃত আনুমানিক হিসাব, শুধু UI smoke-test-এর জন্য; আসল aging গাণিতিক নিয়ম unit test-এর fixtures-এ যাচাই করা হয়)।
- পারফরম্যান্স: প্রতিটা রিপোর্ট পাতা খোলায় ১টা request; dashboard-এ ১টা (`daily-summary`, cash embedded); `keepPreviousData` সব ফিল্টার-চালিত রিপোর্ট query-তে; কোনো `listPrefetch` নেই (রিপোর্ট ডিফল্ট "এই মাস" সার্ভারের হিসাব, hover-এ key মেলানো যায় না — cashbook-এর মতোই)।

## ২০২৬-১১-২০ — Step 7-frontend: কমিশন মডিউল (Akij Cement, owner-only)

- `docs/API.md` backend main (`himel2535/jesan_api`) থেকে `diff` করে দেখা গেছে এখানকার কপিতে পুরো কমিশন সেকশনই (scheme/entries/receipts/summary) অনুপস্থিত ছিল — শুধু `commission.view`/`commission.manage` অনুমতি-ঘোষণা আর অসম্পর্কিত `purchase-counters` endpoint ছিল। backend-এর `docs/API.md` হুবহু কপি করে বসানো হয়েছে (নিজে সম্পাদনা নয়)।
- **quantity ৩ দশমিক পর্যন্ত**: ফ্রন্টএন্ড prompt-এ "বস্তা" দেখে পূর্ণসংখ্যা মনে হলেও, backend DTO/Prisma schema (`CommissionEntry.quantity Decimal(14,3)`) পরীক্ষা করে দেখা গেছে কমিশন entry কোনো নির্দিষ্ট পণ্য/এককের সাথে যুক্ত নয়, তাই product unit-এর `decimals` (বস্তার জন্য ০) প্রযোজ্য নয়। `isPositiveQuantity(value, 3)` ব্যবহার করা হয়েছে, পণ্যের একক থেকে আসা `decimals` নয়। Scheme-এর `targetQty`-ও একই প্যাটার্নে (৩ দশমিক)।
- এককের নাম: কমিশন কোনো নির্দিষ্ট পণ্যের সাথে যুক্ত নয়, তাই প্রতিটা বার্তায় ব্যবসার **default unit** (`GET product-units`-এর `defaultUnitKey`) ব্যবহার করা হয়েছে (`commission/shared.tsx`-এর `useDefaultUnit`), sales module-এর `useUnitInfo`-র প্যাটার্নে — কিন্তু পণ্য-ভিত্তিক নয়, ব্যবসা-ভিত্তিক একটা মাত্র একক।
- Receipt-এর `amount` server-এ শুধু non-negative (০ গ্রহণযোগ্য, কোনো `>0` চেক নেই — docs/API.md ত্রুটি-তালিকায় amount-এর জন্য কোনো code নেই), কিন্তু UI-তে spec অনুযায়ী `>0` client-side যাচাই রাখা হয়েছে (শুধু ব্যবহারকারীর সুবিধার্থে, server-কে block করে না)।
- Query key entity: `commissionScheme`, `commissionEntries`, `commissionEntry`, `commissionSuggestion`, `commissionSummary` — `dealershipKeys` পুনর্ব্যবহার করা হয়েছে (নতুন `createModuleKeys` ডাকা হয়নি)।
- কমিশন সম্পূর্ণ owner-only (`commission.view`/`commission.manage` দুটোই `ownerOnly: true`), তাই `change.request`/`changeEntities` ছোঁয়া হয়নি — manager/salesman-এর জন্য "অনুরোধ করুন" বাটনের প্রশ্নই আসে না।
- Manifest-এর `commission` nav entry (permission, path, icon) আগে থেকেই ছিল — কোনো পরিবর্তন লাগেনি।
- Scheme/entry/receipt ফর্ম `Modal` দিয়ে (category-dialog/adjust-dialog-এর প্যাটার্নে), পূর্ণ পাতা নয় (purchase-form-এর মতো) — কারণ ক্ষেত্রসংখ্যা কম এবং তালিকা পাতা থেকেই দ্রুত সেট/তৈরি করা উদ্দেশ্য।
- Entry preview-এর bonus-পরিমাণ হিসাবের জন্য `quantity − targetQty` এর একটা local, preview-only BigInt subtract লেখা হয়েছে (`entry-form.tsx`-এর `extraOverTarget`) — `src/core/lib/quantity.ts`-এ generic subtract নেই এবং এটা শুধু display-এর জন্য (আসল `calculatedAmount` সবসময় server-এর)।
- e2e mock-এ (`e2e/mock-api.mjs`) কমিশন scheme/entries/receipts/summary in-memory state ও route যোগ হয়েছে, আর `e2e/commission.spec.ts`-এ একটা smoke flow (scheme সেট → entry তৈরি → receipt যোগ → yearly summary) — stock module-এর মতো প্রতিটা dealership sub-module-এর নিজের spec নেই, তবে এটা নতুন একটা পুরো ব্যবসায়িক প্রবাহ বলে একটা minimal spec রাখা হয়েছে।

## ২০২৬-১১-২০ — Collections due, Customers list ও Customer detail থেকে আদায়

- **"collection invalidate হচ্ছে না" — বাগ পাওয়া যায়নি**: `src/modules/dealership/sales/api.ts`-এর `COLLECTION_REFRESH = ['collections', 'customers', 'ledger']` ইতিমধ্যেই `useCreateCollection`, `useCorrectCollection`, `useVoidCollection` তিনটাতেই ব্যবহার হচ্ছিল (CLAUDE.md-এর নিয়ম অনুযায়ী); বিদ্যমান টেস্টও এই তিনটা key-ই যাচাই করে। কোনো কোড বদলানো হয়নি।
- **Collections list-এর "Current Due" কলাম**: একটা collection-এ customer শুধু ref (`id`/`code`/`nameEn`/`nameBn`) — `currentBalance` থাকে না (docs/API.md ও backend DTO দুটোতেই যাচাই করা হয়েছে, দুই রেপোর `docs/API.md` হুবহু মিল)। তাই প্রতিটা সারিতে আলাদা `useCustomer(slug, businessId, customerId)` কল করে বর্তমান বাকি আনা হয়েছে — পাতায় সর্বোচ্চ ১০টা সারি, একই গ্রাহক একাধিকবার থাকলে TanStack Query cache dedupe করে। এটা সচরাচর N+1-ধাঁচের প্যাটার্ন যা পারফরম্যান্স চেকলিস্ট সাধারণত এড়াতে বলে, কিন্তু এখানে bounded (১০ সারি, pagination আছে) বলে গ্রহণযোগ্য ধরা হয়েছে।
- **অনুমতির নাম সংশোধন**: টাস্কে লেখা `collection.manage` কোনো অনুমতি হিসেবে এই কোডবেসে নেই — আদায় তৈরির আসল অনুমতি সবসময় `collection.create` (Collections list-এর নিজের "Take a collection" বাটন, `order-form.tsx`, `/collections/new` পেজ — সবগুলোতেই এটাই ব্যবহৃত)। Customer detail-এর নতুন বাটনেও তাই `collection.create` ব্যবহার করা হয়েছে।
- `deliveredAmount`/`collectedAmount` আগে থেকেই `Customer` type-এ ছিল (backend `@VisibleWith('customer.due.view')` দিয়ে পাঠায়, docs/API.md-তেও আছে) — শুধু Customers **list** পাতায় দেখানো হচ্ছিল না (Detail পাতায় আগে থেকেই ছিল); তাই নতুন টাইপ বা DECISIONS নোট লাগেনি, শুধু list-এ কলাম/লাইন যোগ।
- **Bold নিয়ম**: `currentBalance` সবসময় bold (list + detail + collections-list-এর per-row due), `collectedAmount` bold, `deliveredAmount` bold নয় — এজন্য `Balance` কম্পোনেন্টে (`master-data/shared/display.tsx`) `className` প্রপ যোগ করা হয়েছে (`Money`-তে আগে থেকেই ছিল)। বিদ্যমান সব `<Balance value=.../>` কলে `className` আগে পাঠানো হতো না, তাই এই পরিবর্তন backward-compatible।
- **Customer detail → Collection**: `CollectionForm`-এ `customerId`ও `onSaved` prop যোগ হয়েছে — `customerId` দিলে picker/"change customer" লুকানো থাকে (গ্রাহক লক করা), আর `onSaved` দিলে নতুন কালেকশনের detail পাতায় না গিয়ে ডায়ালগ বন্ধ করে notice দেখায়। Dialog conditionally **mount** করা হয়েছে (`{showCollection ? <Modal>...</Modal> : null}`), শুধু `open` টগল করা নয় — কারণ `Modal` native `<dialog>` টগল করে, children কখনো unmount করে না; সবসময় mount থাকলে প্রতিটা customer detail পেজ-ভিউতে অকারণে `useCollectionMethods`/`useWarmCustomerPicker`/ইত্যাদি কল হতো।

## ২০২৬-১১-২১ — PR #22 (Accounts module) রিভিউ ও ফিক্স

- PR #22 "merge হয়ে গেছে কিন্তু page.tsx তৈরি হয়নি" ধরে কাজ শুরুর অনুরোধ এসেছিল, কিন্তু PR #22 আসলে তখনও **open** ছিল (merge হয়নি), CI সবুজ, এবং এতে ঠিক এই accounts page/module/i18n/manifest/test ইতিমধ্যে ছিল। তাই নতুন করে না বানিয়ে owner-কে জানিয়ে PR #22 রিভিউ করে ফিক্সসহ squash merge করা হয়েছে (owner-এর অনুমোদনে)।
- High-effort code review (৮টা finder angle + verify) চালিয়ে ৯টা finding পাওয়া গেছে; ৩টা গুরুত্বপূর্ণ bug সরাসরি কোড পড়ে ও e2e স্ক্রিনশট দিয়ে নিশ্চিত করে ফিক্স করা হয়েছে: (১) dialog validation-এ literal `"<label> ✗"` এর বদলে আসল i18n বার্তা (`amountInvalid`/`methodRequired`/`required`), (২) `LedgerTable`-এ `RANGE_TOO_LARGE` ছাড়া বাকি সব error (৫০০, network) "কোনো এন্ট্রি নেই" হিসেবে দেখানো বন্ধ করে `LoadError`+retry বসানো হয়েছে, (৩) `AccountsView`-এ entry/payment সেভের পর কোনো সফলতার বার্তা দেখানো হতো না (`onDone` আর্গুমেন্ট ফেলে দিত) — ঠিক করা হয়েছে, এবং পাশাপাশি দেখা গেছে দুই dialog-ই ভুলভাবে `t('title')` (ডায়ালগের শিরোনাম) পাঠাচ্ছিল সফলতার বার্তা হিসেবে, আসল `t('done')`-এর বদলে — সেটাও ঠিক করা হয়েছে।
- `accounts/shared.tsx`-এর `useBusinessDay`/`dateParam`/`useSetFilters` `expenses/shared.tsx`-এর হুবহু কপি ছিল; `reports/shared.tsx`-এর প্যাটার্নে re-export করে dedupe করা হয়েছে।
- এই রেপোর `docs/API.md`-তে অংশ ১৪ (হিসাব/Accounts) পুরোপুরি অনুপস্থিত ছিল যদিও backend (`himel2535/jesan_api` main)-এর `docs/API.md`-তে আগে থেকেই ছিল এবং implementation তার সাথে মিলে যায় (সরাসরি backend service/DTO পড়ে যাচাই করা হয়েছে) — backend-এর `docs/API.md` হুবহু কপি করে sync করা হয়েছে।
- দুটো nit-level finding **ইচ্ছাকৃতভাবে ফিক্স করা হয়নি** (ঝুঁকি/scope বিবেচনায়): `dealership.accounts.methodNames` i18n block `sales.collections.methodNames`/`expenses.methodNames`-এর ডুপ্লিকেট (dedupe করতে sales/expenses module-ও ছুঁতে হতো); `ManualEntryDialog`/`SupplierPaymentDialog` প্রায় ৮৫% কপি-পেস্ট (shared hook-এ refactor করা এই bugfix pass-এর স্কোপের বাইরে ধরা হয়েছে)।
- `manifest.ts`-এর `accounts` nav entry-র পুরনো comment ("Future step (proposal §7.8)... left untouched") সরানো হয়েছে, কারণ পেজ এখন বানানো হয়ে গেছে।
- Customer detail-এ "Ledger" লিংক (`customer.due.view`) বিদ্যমান `dealership.sales.ledger.tabLedger` key পুনর্ব্যবহার করে — নতুন কোনো translation key লাগেনি কোথাও এই কাজে (সব জায়গায় বিদ্যমান key মিলে গেছে: `customers.currentBalance` = "Current due", `sales.collections.new`/`newTitle` = "Take a collection", `sales.collections.form.created` = success notice)।

## ২০২৬-১১-২১ — Accounts summary: Net-এর sign ও advance collection-এর পর stale KPI

- **Net-এ মাইনাস sign না দেখানো (bug)**: `summary-cards.tsx`-এ Net KPI `<Balance>` দিয়ে দেখানো হতো — এই কম্পোনেন্টটা গ্রাহকের balance-এর জন্য (ঋণাত্মক মানে "advance", পরম মান + ব্যাজ দেখায়, sign-ই মুছে দেয়), কিন্তু Net (income − expense) গ্রাহক-ব্যালেন্স না — ঋণাত্মক হলে লোকসান, মাইনাস sign-সহ দেখা উচিত। `<Money>`-তে বদলানো হয়েছে (`formatMoney`/`useFormat().money` ইতিমধ্যেই ঋণাত্মক স্ট্রিং-এ `-৳...` ঠিকভাবে দেখায়, নতুন formatting কোড লাগেনি), সাথে sign অনুযায়ী `text-danger`/`text-success` রং। পুরনো টেস্ট ("shows negative net with Balance (advance badge)") আসলে বাগটাই assert করছিল — ঠিক আচরণ অনুযায়ী বদলানো হয়েছে।
- **Advance collection নেওয়ার পর Total Advance/Total Due KPI রিফ্রেশ না হওয়া (bug)**: `GET accounts/summary` backend-এ সবসময় লাইভ DB query (`accounts.service.ts`-এ cache নেই, `docs/API.md`-ও একই কথা বলে) — ডেটা সবসময় সঠিক। আসল কারণ frontend invalidation: `sales/api.ts`-এর `COLLECTION_REFRESH = ['collections', 'customers', 'ledger']`-এ `accountsSummary`/`accountsLedger` key ছিল না, তাই আদায় নেওয়ার পর Accounts পেজ `staleTime` (৬০ সেকেন্ড) পার না হওয়া পর্যন্ত পুরনো cached সংখ্যা দেখাত। `COLLECTION_REFRESH`-এ `accountsSummary`+`accountsLedger` (collection ledger-এ entry লেখে) যোগ করা হয়েছে; একই কারণে `currentBalance` বদলায় এমন `DELIVERY_REFRESH` ও `ORDER_REFRESH`-এও `accountsSummary` যোগ করা হয়েছে (delivery/order-correction ledger entry লেখে না, তাই `accountsLedger` নয়)।
- **স্কোপ সীমিত রাখা হয়েছে (ইচ্ছাকৃত)**: একই প্যাটার্নের ফাঁক `purchases/api.ts`-এর `PURCHASE_REFRESH`, `expenses/api.ts`-এর `EXPENSE_REFRESH`, `commission/api.ts`-এর `COMMISSION_RECEIPT_REFRESH` এবং master-data-এর customer opening-balance বদলেও আছে (এগুলোও ledger entry লেখে/`currentBalance` বদলায়, তাই Accounts পেজের `totalIn`/`totalOut`/`net`/`totalDue` stale থাকতে পারে) — কিন্তু owner-এর রিপোর্ট করা উপসর্গ শুধু advance collection-কেন্দ্রিক ছিল এবং এই চারটা আলাদা module ছোঁয়া এই bugfix-এর স্কোপের বাইরে ধরা হয়েছে। পরে আলাদা কাজ হিসেবে ঠিক করা দরকার।

## ২০২৬-১১-২১ — Accounts পেজ থেকে "Manual Entry" ও "Supplier Payment" সরানো

- মালিকের অনুরোধে Accounts পেজ থেকে "+ Manual Entry" ও "+ Supplier Payment" বাটন এবং দুটো dialog সম্পূর্ণ সরিয়ে দেওয়া হয়েছে — পেজে এখন শুধু date filter, summary cards, আর ledger table থাকবে।
- সাথে সরানো হয়েছে: `manual-entry-dialog.tsx`, `supplier-payment-dialog.tsx`, `api.ts`-এর `useCreateManualEntry`/`useCreateSupplierPayment`/`useCollectionMethods` (দুই dialog-ই শুধু এগুলো ব্যবহার করত, অন্য কোথাও নয় — `sales/api.ts`-এর নিজের `useCollectionMethods` কপি অক্ষত আছে), `types.ts`-এর `ManualEntryInput`/`SupplierPaymentInput`/`ACCOUNTS_LIMITS`, এবং `en.json`/`bn.json`-এর `accounts.page.addEntry`/`addPayment` + পুরো `accounts.entry`/`accounts.payment` namespace। `POST /accounts/entries` ও `/accounts/payments` এখন frontend থেকে কখনো ডাকা হয় না।
- **ইচ্ছাকৃতভাবে রাখা হয়েছে**: `LedgerEntryType`-এ `manual`/`supplier_payment` এবং `ledger.types.manual`/`supplier_payment` অনুবাদ — আগে তৈরি হওয়া এই ধরনের ledger entry (ও backend-এর ভবিষ্যৎ এন্ট্রি, যদি থাকে) ledger table ও type filter-এ ঠিকভাবে দেখানোর জন্য প্রয়োজন।

## ২০২৬-১১-২১ — Expenses পেজ: "Partial Expenses" নাম ও ৪টা KPI কার্ড

- **নাম বদল**: sidebar-এর `dealership.nav.expenses` ও পেজ শিরোনাম `dealership.expenses.title` — দুটোই "Expenses" থেকে "Partial Expenses" (বাংলা: "আংশিক খরচ") করা হয়েছে, শুধু দুই i18n key বদলে। অন্য namespace-এ যেখানেই "Expenses"/"খরচ" শব্দ আছে (cash book, reports, permissions, accounts, change-requests) — সেগুলো আলাদা ফিচার, স্কোপের বাইরে রাখা হয়েছে (owner-এর সাথে নিশ্চিত করে)।
- **KPI-র ডেটা উৎস (owner-এর সিদ্ধান্ত)**: `GET expenses` list শুধু পাতাভাগ করা সারি + row-count ফেরত দেয় (টাকার যোগফল নেই); সত্যিকারের `totalAmount` আছে শুধু `GET reports/expenses?from=&to=` (`report.view`)-এ। তাই ৪টা কার্ড এই report endpoint থেকেই আনা হয়েছে (বিদ্যমান `useExpensesReport` পুনর্ব্যবহার করে, `reports/api.ts`), `expense.view` থেকে ভিন্ন permission লাগে জেনে। Expenses পেজ নিজে `expense.view`-এ গেটেড; `report.view` না থাকলে চারটা query-ই 403 দেয় আর কার্ডগুলো নীরবে (কোনো error ছাড়া) লুকিয়ে যায় — dashboard-এর cash stats (`cashbook.view`, `report.view`-র বাইরের permission) যেভাবে optional field না থাকলে লুকায়, সেই একই কনভেনশন।
- **"Total Partial Expenses"-এর মানে (owner-এর সিদ্ধান্ত)**: `reports/expenses` এক রেঞ্জে সর্বোচ্চ ৪০০ দিন (`RANGE_TOO_LARGE`), তাই প্রকৃত all-time যোগফল সম্ভব না। "Total" মানে ঠিক করা হয়েছে শেষ ৩৯৯ দিন (ব্যবসার আজকের তারিখ থেকে পেছনে, `+06:00`)—কার্ডের নিচে "Last 400 days." নোট দেখানো হয়। বাকি তিনটা কার্ড: আজ, চলতি মাস (১ তারিখ থেকে আজ), আগের পুরো ক্যালেন্ডার মাস।
- এই নতুন `reports/expenses` query invalidate হয় না কিনা তা `DECISIONS.md`-এর আগের এন্ট্রির (Accounts summary stale KPI) মতো bug এড়াতে `expenses/api.ts`-এর `EXPENSE_REFRESH`/`EXPENSE_CATEGORY_REFRESH`-এ `reportsExpenses` entity যোগ করা হয়েছে, যাতে খরচ তৈরি/সংশোধন/বাতিলের পর কার্ডগুলো stale না থাকে।

## ২০২৬-১১-২১ — Expenses KPI কার্ড: শুধু 403-এ নীরব, বাকি সব error দৃশ্যমান (fix)

- **বাগ**: `ExpensesSummaryCards`-এ আগে চারটা report query-র যেকোনো `isError` (status নির্বিশেষে) হলেই কার্ড নীরবে `null` রিটার্ন করত। মালিকের local-এ ("localhost-এও দেখা যাচ্ছে না") KPI কার্ড অদৃশ্য থাকার রিপোর্ট পেয়ে root cause খুঁজতে গিয়ে এটা ধরা পড়ে: ডিজাইন ইচ্ছাকৃতভাবে শুধু `report.view` না থাকার (403) জন্য নীরব থাকার কথা ছিল, কিন্তু কোড ভুলে **সব** error (network, 500, ভুল permission string, ইত্যাদি) একইভাবে লুকিয়ে ফেলত — তাই আসল সমস্যা থাকলেও মালিক কিছুই দেখতেন না, কোনো সূত্র ছাড়াই।
- **যাচাই**: `jesan_api` (backend, `main`) পড়ে নিশ্চিত হওয়া গেছে `GET reports/expenses` ঠিক আছে, `report.view` দিয়েই গেটেড, এবং owner role ডিফল্টভাবে (`ownerOnly` ছাড়া) সব permission পায় (`access-resolver.service.ts`)। e2e mock backend (production build ও `next dev` দুই মোডেই) দিয়ে পুরো ফ্লো যাচাই করে KPI কার্ড, ৪টা API কল আর সঠিক সংখ্যা — সবই ঠিকভাবে কাজ করতে দেখা গেছে। তাই কোডের মূল লজিক ভুল ছিল না; শুধু error-হ্যান্ডলিং যেকোনো ব্যর্থতা থেকে একই "নীরব" আচরণ দেখাত।
- **ফিক্স**: `summary-cards.tsx`-এ শুধু `isForbidden` (status 403) হলে `null`; অন্য যেকোনো real error হলে এখন `LoadError` + retry বাটন দেখায় (অন্য সব module-এর কনভেনশন অনুযায়ী) — retry চারটা query-ই আবার চালায়। নতুন টেস্ট যোগ হয়েছে: `report.view` না থাকলে (403) নীরব, কিন্তু অন্য ব্যর্থতায় (500) এখন "The server is not reachable..." বার্তা দেখায়।
- **মালিকের জন্য নোট**: কার্ড এখনো না দেখা গেলে এখন browser-এ একটা দৃশ্যমান error-বক্স আসবে (যদি real error থাকে); যদি কিছুই না আসে আর কার্ডও না দেখা যায়, তাহলে সেটা মানে লগইন করা ইউজারের ওই ব্যবসায় `report.view` নেই (Settings → Roles-এ দেখুন)।

## ২০২৬-১১-২১ — Sales পেজে ৭টা KPI কার্ড + প্রতিটা অর্ডারের "Due" (মালিকের অনুরোধে)

- **KPI কার্ড ও ডেটা উৎস**: Today's/This Month's/Total Sales Amount `GET reports/sales` (`report.view`, delivery-ভিত্তিক) থেকে; Total/This Month's Orders `GET orders` (`sale.view.all`/`own`, পেজ নিজেই এই অনুমতিতে গেটেড, তাই কখনো 403 দেয় না)-এর `.total` (row count, no date-range cap) থেকে; Total/This Month's Deliveries একইভাবে `GET deliveries` (`delivery.view`)-এর `.total` থেকে। তিনটা group-এর অনুমতি আলাদা, তাই প্রতিটা group স্বাধীনভাবে নিজের 403-এ নীরব হয় (Expenses-এর কনভেনশন অনুসরণ করে) — salesman-এর `report.view`/`delivery.view` না থাকলে শুধু Order-count কার্ড দুটো দেখা যায়।
- **"Total Sales" = শেষ ৩৯৯ দিন**: `reports/sales` এক রেঞ্জে সর্বোচ্চ ৪০০ দিন (`RANGE_TOO_LARGE`), তাই Expenses-এর precedent অনুসরণ করে "Total Sales" মানে প্রকৃত all-time নয়, শেষ ৩৯৯ দিন — কার্ডের নিচে "Last 400 days." নোট। বিপরীতে Total Orders/Deliveries সত্যিকারের all-time (`GET orders`/`GET deliveries`-এ কোনো রেঞ্জ-cap নেই)।
- **প্রতিটা অর্ডারের "Due" (owner-এর সিদ্ধান্ত)**: API-তে order-এর নিজস্ব due/balance ফিল্ড নেই, এবং `collection.orderId` শুধু reference, allocation নয় (docs/API.md §11)। তাই order detail পেজে "Due for this order" = সেই অর্ডারের active deliveries-এর totalAmount যোগফল − সেই অর্ডারকে reference করা active collections-এর amount যোগফল — **client-side display-only যোগফল** (`sumMoney`, BigInt, নতুন কোনো ব্যবসার নিয়ম না), approximate (সত্যিকারের allocation নয়)। `collection.view` না থাকলে বা কোনো active delivery-র totalAmount অনুপস্থিত থাকলে (price permission নেই) পুরো row-ই বাদ।
- **সীমাবদ্ধতা**: Order detail-এর collections query শুধু প্রথম পাতা (১০টা পর্যন্ত) আনে; ১০-এর বেশি collection reference করা order-এ due হিসাব আন্ডারকাউন্ট হতে পারে (display-এও একই সীমাবদ্ধতা আগে থেকেই ছিল)।

## ২০২৬-১১-২২ — "Last 400 days" সরিয়ে lifetime total (মালিকের অনুরোধে; jesan_api PR #22-এর সাথে)

- **backend-এর cap সরানো**: `jesan_api`-তে `reports/*`, `accounts/summary`, `accounts/ledger`, `cash-book`-এর ৪০০ দিনের `RANGE_TOO_LARGE` cap সম্পূর্ণ সরানো হয়েছে (`resolveDateRange`)। এখন যেকোনো প্রস্থের `from`/`to` চাওয়া যায়, lifetime পর্যন্ত।
- **Sales/Collections/Expenses "Total" KPI কার্ড**: `sales/shared.tsx` ও `expenses/shared.tsx`-এ `MAX_REPORT_RANGE_DAYS = 399` সরিয়ে একটা স্থির `LIFETIME_FROM = '2000-01-01'` anchor বসানো হয়েছে (`ranges.total.from`) — এখন থেকে এই কার্ডগুলো সত্যিকারের lifetime total দেখায়, ৩৯৯-দিনের approximation নয়। "Last 400 days."/"শেষ ৪০০ দিন।" নোট (তিন জায়গায়) আর দেখানো হচ্ছে না — এগুলো আর সত্যি নয় বলে বাদ দেওয়া হয়েছে, বদলানো হয়নি।
- **Accounts Ledger ও Cash Book**: ইউজার-নির্বাচিত `from`/`to`-তে আর `RANGE_TOO_LARGE` আসে না (ব্যাকএন্ড cap সরানোয়), তাই ledger-table.tsx-এর সেই dead error branch আর `rangeError` অনুবাদ-key সরানো হয়েছে। দুই পেজেই (`accounts-view.tsx`, `cash-book-view.tsx`) একটা নতুন "All time" shortcut বাটন যোগ হয়েছে, যা `from`-কে একই `LIFETIME_FROM` আর `to`-কে আজকের তারিখে সেট করে — নইলে lifetime দেখতে ইউজারকে হাতে ২৫+ বছরের পুরনো তারিখ বসাতে হতো।
- **`RANGE_TOO_LARGE` dead code**: `src/core/api/error-codes.ts` আর দুই অনুবাদ ফাইলের `apiErrors.RANGE_TOO_LARGE` entry সরানো হয়েছে — backend আর কখনো এই code পাঠাবে না।
- এই দুই সিদ্ধান্ত (৩৯৯-দিনের approximation, ও `RANGE_TOO_LARGE` cap) আগের এন্ট্রিতে (২০২৬-১১-২১, Sales KPI) নথিভুক্ত ছিল — এটা সেই সিদ্ধান্তগুলো বাতিল করে।
- `sales/api.ts`-এর `ORDER_REFRESH`/`DELIVERY_REFRESH`-এ `reportsSales` entity যোগ করা হয়েছে (Expenses-এর `reportsExpenses` ফিক্সের precedent), যাতে ডেলিভারি/অর্ডার create-correct-void-এর পর "Sales" কার্ডগুলো stale না থাকে।

## ২০২৬-১১-২২ — Sales পেজের ৭টা KPI কার্ড দুই সারিতে সাজানো + Customer বাটন New order-এর পাশে (মালিকের অনুরোধে)

- **KPI কার্ড লেআউট**: `SalesSummaryCards`-এর আগের একক `sm:grid-cols-2 lg:grid-cols-4` grid-টা দুইটা আলাদা সারিতে ভাগ করা হয়েছে: উপরে Today's/This Month's/Total Sales (৩-কলাম, মাঝেরটা স্বাভাবিকভাবেই মাঝে বসে), নিচে Total/This Month's Orders ও Total/This Month's Deliveries (৪-কলাম)। প্রতিটা group-এর আলাদা permission-gating (403-এ লুকানো, অন্য error-এ `LoadError`) আগের মতোই আছে, শুধু JSX দুই সারিতে ভাগ হয়েছে। `SalesSummaryCardsSkeleton`-ও মিলিয়ে ৩+৪ সারিতে ভাগ করা হয়েছে।
- **Customer বাটন**: Orders পেজে (`orders-list.tsx`) আগে পুরো-প্রস্থের আলাদা সারিতে ছিল (`CustomerFilter`); এখন Collections পেজের (`collections-list.tsx`) প্যাটার্ন অনুসরণ করে `CustomerFilterTrigger`/`CustomerFilterPanel` আলাদা করে filter-এর সারিতে বসানো হয়েছে — তাই এখন date/status filter আর "New order" বাটনের সাথে একই লাইনে থাকে, প্যানেল আগের জায়গাতেই নিচে খোলে।
- **"Last 400 days" টেক্সট**: কোডে আর নেই (আগের এন্ট্রি, commit cad847e/PR #31-এ আগেই সরানো হয়েছে) — মালিক কনফার্ম করেছেন এটা আর কোথাও দেখা যাচ্ছে না।

## ২০২৬-১১-২২ — Sales KPI কার্ড center-align + Deliveries পেজেও Customer বাটন filter-এর সারিতে (মালিকের অনুরোধে, PR #32-এর follow-up)

- **KPI কার্ড center-align**: `summary-cards.tsx`-এর local `Card` component-এর wrapping `<div>`-এ `text-center` যোগ করা হয়েছে, যাতে label ও value প্রতিটা কলামের মাঝে বসে (আগে বাম দিকে align ছিল)। **স্কোপ ইচ্ছাকৃতভাবে শুধু Sales KPI কার্ডে সীমাবদ্ধ** — একই dt/dd প্যাটার্ন Collections/Expenses/Accounts/Customer ledger/Commission-এও আছে (কোনো shared component নেই, প্রতিটা আলাদা আলাদা inline markup), কিন্তু মালিক নিশ্চিত করেছেন এই রাউন্ডে শুধু Sales-এই লাগবে।
- **Deliveries পেজেও Customer বাটন filter-এর সারিতে**: `deliveries-list.tsx`-ই ছিল শেষ পেজ যেটা পুরোনো একক `CustomerFilter` কম্পোনেন্ট (পুরো-প্রস্থের আলাদা সারি) ব্যবহার করছিল। এখন Orders/Collections-এর মতোই `CustomerFilterTrigger`/`CustomerFilterPanel` আলাদা করে from/to/status filter-এর সারিতে বসানো হয়েছে। যেহেতু আর কোনো consumer নেই, পুরোনো `CustomerFilter` কম্পোনেন্ট `shared.tsx` থেকে সম্পূর্ণ সরিয়ে ফেলা হয়েছে (dead code)।
- **Customer dropdown ১০০+ গ্রাহকে কী হবে (মালিকের প্রশ্ন, কোনো কোড বদল লাগেনি)**: `useCustomers` আগে থেকেই server-paginated (`GET /customers` একটা `Page<Customer>` দেয়), আর `CustomerPicker`-এ ৩০০ms debounce করা search box + `max-h-64 overflow-y-auto` scrollable list আছে — তাই গ্রাহক ১০০/২০০+ হলেও dropdown একসাথে সব দেখায় না, প্রতিবার শুধু এক পাতা (search-filtered) আনে। এটা ইতিমধ্যে ঠিক ছিল, নতুন কিছু বানাতে হয়নি।

## ২০২৬-১১-২২ — Purchases KPI কার্ড (৫টা) + Product ফিল্টার বাটন filter-এর সারিতে

- **ব্যাকএন্ড গ্যাপ পাওয়া গিয়েছিল**: `GET purchases` শুধু পাতাভাগ করা তালিকা আর row-সংখ্যা (`total`) দেয়, যোগফল নয়। `jesan_api`-তে `GET b/:businessSlug/purchases/summary?from=&to=` যোগ করা হয়েছে (PR #23)। `reports/*`-এ নয় — `reports/*`-এর কোনো endpoint কখনো কেনা-দাম বহন করে না (ডকুমেন্টেড invariant), তাই `purchases` controller-এ নিজের অনুমতি-মডেল পুনর্ব্যবহার করা হয়েছে: `purchase.view` দিয়ে endpoint, `totalAmount` `product.cost.view`-এ field-gated।
- **৫টা KPI কার্ড** (Total Purchase Amount, Total Quantity, Today's/This Month's/This Year's Purchases) `purchases/summary-cards.tsx`-এ, `ExpensesSummaryCards`-এর প্যাটার্নে (চারটা ফিক্সড তারিখ-রেঞ্জ, এখানে পাঁচ নম্বর `thisYear` নতুন)। পার্থক্য: Expenses-এ পুরো কার্ড 403-এ লুকায়, কিন্তু এখানে amount নিজেই আলাদাভাবে gated (`product.cost.view`) — তাই শুধু সেই একটা সংখ্যা অনুপস্থিত থাকে, পুরো কার্ড নয় (quantity/count সবসময় দেখা যায়)।
- **Product ফিল্টার বাটন** আগে আলাদা সারিতে ছিল, এখন From/To/Supplier/Status-এর সাথে একই `flex` সারিতে, লেবেলসহ (অন্য ফিল্টারগুলোর মতোই `items-end` সারিবদ্ধ)।
- মোট ৪টা আলাদা `purchases/summary` query (total/today/thisMonth/thisYear) — কেনা তৈরি/সংশোধন/বাতিলের পর `purchasesSummary` entity-ও `PURCHASE_REFRESH`-এ যোগ করা হয়েছে যাতে কার্ড রিফ্রেশ হয়।

## ২০২৬-১১-২২ — KPI কার্ডের গ্রুপিং hook-গুলো `useQueries`-এ, 60s staleTime

- **`useQueries`-এ রূপান্তর**: `usePurchasesSummary`, `useSalesSummaryAmounts`, `useOrderCounts`, `useDeliveryCounts`, `useCollectionsSummaryAmounts`, `useExpensesSummary` — প্রতিটা আগে N-টা সাইবলিং `useQuery` কল করত (React নিজেই parallel fire করে), এখন একটা `useQueries({ queries: [...] })` কলে একত্র। মালিকের সরাসরি অনুরোধ অনুযায়ী `useQueries` ব্যবহার করা হয়েছে, যদিও network-এ এটা literal waterfall ছিল না। Return shape (named object: `{ total, today, ... }`) অপরিবর্তিত রাখা হয়েছে যাতে component-গুলো বদলাতে না হয়।
- **`queryKey` অপরিবর্তিত**: প্রতিটা entry-র `queryKey` আগের মতোই (`dealershipKeys.list(businessId, '<entity>', query)`), কারণ `*_REFRESH` constant-গুলো এটার সাথে মিলিয়ে invalidate করে।
- **নতুন factory function**: `reports/api.ts`-এ `salesReportQuery`/`collectionsReportQuery`/`expensesReportQuery` (এক্সপোর্টেড), `sales/api.ts`-এ local `ordersQuery`/`deliveriesQuery` — আগের single-window hook (`useSalesReport` ইত্যাদি) আর `useQueries`-এর ভেতরের entry দুটোই একই query-options object পুনর্ব্যবহার করে।
- **staleTime 60s**: শুধু KPI-card-facing query-গুলোতে (`reports/sales`, `reports/collections`, `reports/expenses`, `purchases/summary`, `reports/daily-summary`, আর `useOrderCounts`/`useDeliveryCounts`-এর `orders`/`deliveries` entry — এগুলোর জন্য আলাদা local factory, কারণ `useOrders`/`useDeliveries` list page-এও ব্যবহার হয়, সেখানে default 30s-ই রাখা হয়েছে)। `useDailySummary`-তে আগে `staleTime`/`placeholderData` কোনোটাই ছিল না, এখন দুটোই যোগ হয়েছে (`accounts/api.ts`-এর `useAccountsSummary`-র মতোই)।

## ২০২৬-১১-২৩ — Dashboard redesign: ৮টা KPI section, বিদ্যমান summary-cards পুনর্ব্যবহার করে (নতুন backend endpoint লাগেনি)

- **কোনো নতুন backend endpoint লাগেনি**: প্ল্যান-পর্বে ধরে নেওয়া হয়েছিল Accounts-এ আলাদা "Total Income"/"Total Expense" ফিল্ড লাগবে, কিন্তু `accounts/summary`-র আসল schema-তে (`accounts/types.ts`) শুধু `totalIn`/`totalOut`/`net`/`totalDue`/`totalAdvance` আছে — আর বিদ্যমান i18n key (`accounts.summary.totalIn` = "Total income", `totalOut` = "Total expense") নিশ্চিত করে এগুলো একই জিনিস, আলাদা ফিল্ড নয়। তাই মালিকের চাওয়া ৭টার বদলে ৫টা মেট্রিক দেখানো হয়েছে।
- **`totalDue`/`totalAdvance` per-period দেখানো হয়নি**: docs/API.md স্পষ্ট করে বলে এই দুটো date-range independent (সারাক্ষণিক), তাই Accounts section-এ Total/Today/This Month প্রতিটার জন্য আলাদা না দেখিয়ে একবারই দেখানো হয়েছে — নকল/বিভ্রান্তিকর সংখ্যা এড়াতে।
- **Sales, Purchases, Collections, Expenses section বিদ্যমান `*SummaryCards` কম্পোনেন্ট পুনর্ব্যবহার করে** (`sales/summary-cards.tsx`, `purchases/summary-cards.tsx`, `expenses/summary-cards.tsx`, `sales/collections/collection-summary-cards.tsx`) — নতুন কার্ড markup লেখা হয়নি, permission/403/skeleton/error হ্যান্ডলিং সেই এক জায়গাতেই থাকে। Dashboard-এর wrapper section নিজেও একই cached query আবার call করে (React Query dedupe করে, নতুন network call হয় না) যাতে 403-এ শুধু ভেতরের কার্ড না, section heading-টাও লুকায়।
- **Pending delivery amount বাদ দেওয়া হয়েছে**: "pending delivery count ও amount" চাওয়া হয়েছিল, কিন্তু backend-এ কোনো aggregate endpoint নেই। Count ঠিকভাবে পাওয়া যায় (`GET orders?status=open`-এর `Page.total`), কিন্তু amount client-side pagination দিয়ে যোগ করলে ১০-এর বেশি pending order থাকলে ভুল হবে — তাই amount বাদ দেওয়া হয়েছে, ভুল সংখ্যা দেখানোর চেয়ে। Backend-এ aggregate যোগ হলে এখানে যোগ করা হবে।
- **Commission section `useCan('commission.view')` দিয়ে gated** (মালিকের সরাসরি নির্দেশ অনুযায়ী), বাকি সব section API response-এর 403 দিয়ে gated — কারণ `commission.view` ইতিমধ্যে owner-only (`permissions.ts`/docs/API.md), তাই এটাই আসল owner-gate।
- **Net** owner-only করা হয়নি: `accounts/summary`-তে `net` আর `totalIn`/`totalOut`-এর মতোই `ledger.view`-এ পাওয়া যায় (কোনো `profit.view` gating নেই ডকুমেন্টে) — তাই Net manager-ও দেখেন, শুধু owner না। `profit.view` পারমিশন ডকুমেন্টে আছে কিন্তু কোনো endpoint এখনো সেটা ব্যবহার করে না।
- **Customers/Stock section** বিদ্যমান `useCustomers`/`useProducts` (page=1) দিয়ে, `.total` থেকে সংখ্যা — আলাদা "count" endpoint বা wrapper hook লাগেনি, একই query key ব্যবহারের ফলে cache invalidation স্বয়ংক্রিয়ভাবে ঠিক থাকে।

## ২০২৬-১১-২৩ — Dashboard v2: horizontal KPI card, নতুন রঙ শুধু dashboard-scoped token (মালিকের ৩য় round নির্দেশ অনুযায়ী)

আগের dashboard redesign (৮টা section) মালিকের পছন্দ হয়নি — নতুন reference screenshot অনুযায়ী ৩২টা horizontal KPI card (icon বাঁয়ে, label/amount/trend ডানে), Revenue Overview chart, Top 5 Customers, Sales Summary donut বানানো হচ্ছে। সাথে আগের সংস্করণের একটা আসল বাগও ঠিক হচ্ছে: Total Income, Total Partial Expenses, This Month's Collection, Total Customers ইত্যাদি কোডে সরাসরি `'N/A'` হার্ডকোড ছিল যদিও backend-এ ডেটা ছিল।

- **নতুন রঙ-প্যালেট `src/core/theme/tokens.css`-এর `:root`/`[data-theme]`-এ নয়, `.dash-scope` ক্লাস-এ স্কোপ করা হয়েছে** (dashboard page-এর wrapper div-এ বসবে) — মালিক স্পষ্ট বলেছেন reference-এর 'Main' palette (page bg #F5F7FF, primary text #101B46 ইত্যাদি) পুরো অ্যাপে (products/customers/settings) প্রয়োগ হবে না, শুধু dashboard-এ। এভাবে বিদ্যমান `--bg`/`--fg`/`--fg-muted`/`--focus`/`--success`/`--danger`/`--border` অপরিবর্তিত থাকে, বাকি সব পেজ আগের মতোই দেখায়।
- নতুন CSS ফাইল/import mechanism তৈরি না করে বিদ্যমান `tokens.css`-এই যোগ হয়েছে (ইতিমধ্যে `globals.css`-এ `@import` করা আছে), যাতে module-level CSS import-এর নতুন প্যাটার্ন (এই কোডবেসে এখনো নেই) চালু করতে না হয়।
- **Dark-mode variant মালিক দেননি** (reference শুধু light-mode screenshot) — প্রতিটা hue-র dark সংস্করণ নিজে বানানো হয়েছে: blue/green icon ও primary/success অ্যাক্সেন্ট বিদ্যমান `--focus`/`--success` dark মানের (#60a5fa/#4ade80) সাথে মিলিয়ে পুনর্ব্যবহার করা হয়েছে (consistency), বাকি hue (purple/orange/pink/aqua)-র জন্য সমতুল্য উজ্জ্বল শেড এবং প্রতিটা card-এর গাঢ়, hue-টিন্টেড dark ব্যাকগ্রাউন্ড ও বর্ডার বানানো হয়েছে। `contrast.test.ts` শুধু `:root`/`[data-theme]` পার্স করে, তাই `.dash-scope` কভার করে না — contrast নিজে হাতে formula দিয়ে যাচাই করা হয়েছে: light/dark দুই মোডেই primary ও muted টেক্সট সব pastel card-এ ≥ 12.7:1 (৪.৫:১ অনেক বেশি), icon badge-এর white glyph সব hue-তে ≥ 3.3:1 (non-text ৩:১ threshold) **শুধু orange বাদে** (২.১৫:১, fail) — তাই orange icon badge-এ সাদার বদলে dark navy (`--dash-fg`) glyph ব্যবহার করা হয়েছে (৭.৭২:১), বাকি ৫টায় সাদা।
- Icon badge সবসময় solid hue ব্যাকগ্রাউন্ড + সাদা (বা orange-এ navy) glyph — card-এর pastel ব্যাকগ্রাউন্ড থেকে আলাদা টোকেন (`--dash-{hue}-icon-bg` বনাম `--dash-{hue}-card-bg`), বিদ্যমান সাইটের "solid bg + contrasting fg" icon-container কনভেনশন (যেমন `business-card.tsx`) অনুসরণ করে।

## ২০২৬-১১-২৩ — Revenue Overview chart: daily view সর্বোচ্চ ১০টা সাম্প্রতিক সক্রিয় দিন, বছরের view মাসভিত্তিক

`reports/sales`/`reports/collections`-এর `groupBy=date` server-side ১০ সারি/পাতায় paginate করে (`PAGE_SIZE=10`, `jesan_api`-এর ধ্রুবক)। This Month/Last Month view-এ তাই চার্টে শুধু সেই মাসের সাম্প্রতিক সর্বোচ্চ ১০টা _সক্রিয়_ দিন দেখানো হয় (একাধিক পাতা টেনে আনা হয়নি — performance checklist-এর "লুপে query নয়" নীতির বিপরীত হতো, আর ৩১ দিনের প্রতিটার জন্য আলাদা call করাও অতিরিক্ত); উপরের KPI card-এর "This Month's Sales" সবসময় সম্পূর্ণ মাসের আসল যোগফল (`totalAmount`, pagination-নিরপেক্ষ), চার্ট শুধু ভিজ্যুয়াল ট্রেন্ডের sample। This Year view দৈনিক নয়, **প্রতি মাসের জন্য একটা করে data point** — জানুয়ারি থেকে চলতি মাস পর্যন্ত প্রতিটা মাসের জন্য আলাদা `from`/`to` দিয়ে (groupBy ছাড়াই, তাই `totalAmount` সম্পূর্ণ মাসের আসল যোগফল) সমান্তরাল (`useQueries`) call — সর্বোচ্চ ১২টা call/metric, bounded ও সঠিক, কোনো সিকোয়েন্সিয়াল await নেই।

## ২০২৬-১১-২৩ — Dashboard v3: ৩২টা KPI card থেকে ৭টায় সংক্ষিপ্ত, heading সরানো (মালিকের নির্দেশ অনুযায়ী)

মালিক একটা চূড়ান্ত reference screenshot দিয়ে dashboard আরো সংক্ষিপ্ত করতে বলেছেন: ঠিক ৮টা (পরে ৭টায় নেমে আসা, নিচে দেখুন) মূল KPI card, 4-per-row, top nav-এর ঠিক পরেই শুরু — কোনো বড় "Dashboard"/ব্যবসার নাম heading ছাড়া।

- **Target Achievement card বাদ দেওয়া হয়েছে** (মালিকের অনুমোদনক্রমে): backend-এ কোনো সামগ্রিক sales-target concept নেই (শুধু commission scheme-এর bonus threshold `targetQty` আছে, যা সম্পূর্ণ আলাদা জিনিস)। তাই চূড়ান্ত card সংখ্যা ৮ নয়, **৭**। ভবিষ্যতে owner যদি মাসিক sales target সেট করার সুবিধা চান, backend-এ নতুন concept/endpoint লাগবে।
- **"Net Profit" card Accounts-এর বিদ্যমান `net` ফিল্ড (income − expense, cash-basis) পুনর্ব্যবহার করে**, নতুন নামে (মালিকের অনুমোদনক্রমে) — এটা প্রকৃত cost-based লাভ (COGS বাদ দেওয়া) নয়; docs/API.md অনুযায়ী `reports.finance.view`/`summary.finance.view` লাভের ভবিষ্যৎ ধাপের জন্য আগে থেকে ঘোষিত, কিন্তু এখনো কোনো endpoint নেই।
- **"Cash & Bank" card শুধু cash-book-এর closing balance দেখায়** (মালিকের অনুমোদনক্রমে) — সিস্টেমে আলাদা ব্যাংক-অ্যাকাউন্ট ব্যালেন্স ট্র্যাক করার কোনো ব্যবস্থা নেই, তাই লেবেল "Cash & Bank" হলেও ডেটা শুধু নগদ।
- **"Commission" card-এর headline মান `totalCalculated`** (Calculated/Received/Pending তিনটার বদলে একটা, মালিকের অনুমোদনক্রমে) — reference design-এর ভূমিকার সাথে মিলিয়ে।
- **`/b/[slug]` dashboard route থেকে `<PageHeader title={business name} />` সরানো হয়েছে** যখন `report.view` থাকে (dashboard আসলে দেখানো হয়) — dashboard content সরাসরি KPI grid দিয়ে শুরু হয়; `report.view` না থাকলে (EmptyState fallback) PageHeader আগের মতোই থাকে, কারণ সেটা dashboard নয়।
- **Purchases দাশবোর্ড card-এর জন্য `usePurchasesSummary` (৪টা query: total/today/thisMonth/thisYear) বাদ দিয়ে সরাসরি `purchaseTotalsQuery`-এর একটা `total` query ব্যবহার করা হয়েছে** — শুধু একটা মোট সংখ্যা লাগে বলে বাকি ৩টা অপ্রয়োজনীয় network call বাদ দেওয়া হয়েছে (performance checklist অনুযায়ী)।
- বাকি সব বাদ পড়া card-এর (opening balance, net cash, today/this-month income-expense-net-sales-purchase-collection, total advance, partial expenses, commission received/pending) data/hook/translation key মুছে ফেলা হয়েছে — অব্যবহৃত কোড/key না রাখতে।
