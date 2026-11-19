# CLAUDE.md — jesan-web

Jesan Enterprise মাল্টি-বিজনেস ERP প্ল্যাটফর্মের frontend (Next.js App Router)। Backend আলাদা repo: jesan-api। প্রধান নির্দেশনা রুটের প্রপোজাল PDF (v3); কাজের আগে সংশ্লিষ্ট সেকশন পড়ো।

## কাজের ধরন (স্থায়ী নিয়ম)

1. **প্ল্যান আগে:** প্রতিটা বড় কাজের শুরুতে মালিককে প্ল্যান দেখাও, সব বড় সিদ্ধান্ত পরিষ্কার লিখে। অনুমোদন মানেই পুরো কাজের অনুমতি।
2. **অনুমোদনের পর নিজে শেষ করো:** আর কিছু জিজ্ঞেস না করে কোড, টেস্ট, lint, type-check, build, commit, push, PR খোলা, এবং CI-র সব চেক পাস করলে নিজেই `main`-এ **squash merge**।
3. **কখন থামবে:** অনুমোদিত প্ল্যানের বাইরের বড় সিদ্ধান্ত লাগলে (টাকার হিসাবের নিয়ম বদল, নিরাপত্তা, ডেটা মুছে ফেলার ঝুঁকি, force push, আসল secret বা production) থেমে মালিককে জানাও। ছোট সিদ্ধান্ত নিজে নাও এবং `DECISIONS.md`-তে লেখো।
4. **চেক ব্যর্থ হলে merge নয়:** নিজে ঠিক করো; না পারলে জানাও। টেস্ট skip/disable করে সবুজ করা নিষেধ।
5. **Secret:** আসল secret কখনো কোডে, চ্যাটে বা commit-এ নয় (নিচে বিস্তারিত)।
6. **শেষে রিপোর্ট:** প্রতিটা কাজের শেষে ছোট করে জানাও কী হলো এবং মালিকের কী করতে হবে।

## API চুক্তি (`docs/API.md`)

- প্রতিটা কাজ শুরুর আগে backend repo (`himel2535/jesan_api`) `main`-এর `docs/API.md`-র সঙ্গে এখানকার `docs/API.md` মিলিয়ে নাও। ভিন্ন হলে আগে হুবহু কপি করে হালনাগাদ করো (নিজে সম্পাদনা নয়; Prettier-এর বাইরে রাখা)।
- বাধ্যতামূলক ঘর, দৈর্ঘ্য, টাকার সীমা doc-এ স্পষ্ট না থাকলে অনুমান নয়: backend-এর DTO ও Prisma schema পড়ে মেলাও; তাও না মিললে মালিককে জানাও।

## Git branch নিয়ম

- প্রতিটা নতুন কাজের জন্য সর্বশেষ `main` থেকে নতুন নামের branch: `claude/<কাজের-নাম>` (যেমন `claude/branch-rules`)। আগের কোনো branch পুনরায় ব্যবহার নয়।
- **force push কখনো নয়** (`--force`, `--force-with-lease` কোনোটাই নয়)।
- `main`-এ সরাসরি push নয়; সব পরিবর্তন PR দিয়ে, CI সবুজ হলে squash merge।
- merge-এর পর branch মুছে ফেলো; মুছতে না পারলে শুধু রিপোর্টে জানাও।

## CI (GitHub Actions)

- `.github/workflows/ci.yml` প্রতিটা PR-এ ও `main`-এ push-এ চলে: Node (`.nvmrc` থেকে) → `npm ci` → `format:check` → `lint` → `type-check` → `test` → `build` → Playwright (`npm run test:e2e`, `e2e/mock-api.mjs`-এর উপর)।
- CI সবুজ না হলে merge নয়। লোকালে একই ধাপগুলো চালিয়ে তারপর push করো।
- নতুন স্ক্রিপ্ট (যেমন test) যোগ হলে CI-তেও যোগ করো। Action-এর ভার্সন exact tag-এ রাখো।

## প্রতিটা কাজের পর (বাধ্যতামূলক)

```bash
npm run dev          # চালিয়ে পেজ নিজে দেখো (UI বদলালে /dev/ui-তে দুই থিম ও দুই ভাষায়)
npm run lint
npm run type-check
npm test
npm run build
npm run test:e2e     # Playwright (build-এর পরে); নতুন প্রবাহে e2e/mock-api.mjs-এ endpoint যোগ করো
```

সবগুলো পাস না করলে কাজ শেষ নয়। নতুন উপাদান বা logic-এর সাথে টেস্টও লেখো। `npm run format` দিয়ে ফরম্যাট ঠিক রাখো।

## স্থাপত্য (প্রপোজাল সেকশন ৩)

- `src/core` সবার জন্য এক; কোনো ব্যবসার নাম বা নিয়ম core-এ নয়।
- `src/modules/<type>` (এখন `dealership`) শুধু core ব্যবহার করবে। core কখনো module import করবে না (ESLint দিয়ে আটকানো), এক module অন্য module সরাসরি ডাকবে না।
- API ডাকা শুধু `src/core/api` এর মাধ্যমে।
- Route: `/` Enterprise Dashboard, ব্যবসার ভেতরে `/b/[businessSlug]/...`।

## Frontend নিয়ম

**লেখা ও ভাষা (next-intl)**

- UI-এর কোনো লেখা কোডে নয়: সব `messages/en.json` ও `messages/bn.json`-এ, দুই ফাইলে একই key (টেস্ট যাচাই করে)। JSX-এ সরাসরি লেখা ESLint error।
- URL-এ ভাষার প্রিফিক্স নেই; ভাষা `NEXT_LOCALE` cookie-তে।
- নতুন namespace client component-এ লাগলে `src/core/i18n/client-messages.ts`-এ যোগ করো, নইলে ব্রাউজারে যাবে না।
- সংখ্যা, টাকা, পরিমাণ, তারিখ শুধু `src/core/i18n/format.ts` (`useFormat()` client-এ) দিয়ে। নিজে `toLocaleString` বা ৳ বসানো নয়। টাকার হিসাব ব্রাউজারে নয়।

**থিম ও স্টাইল**

- রঙ/ছায়া/মাপ শুধু টোকেন ক্লাস দিয়ে (`bg-surface`, `text-fg-muted`, …); hex বা `dark:` নয়। নতুন টোকেন `src/core/theme/tokens.css`-এ, light ও dark দুটোতেই, এবং কনট্রাস্ট টেস্টে জোড়া যোগ করো।
- `glass` (blur) শুধু Card, Sidebar, Modal-এ। টেবিল, লম্বা তালিকা বা topbar-এ নয়।
- কীবোর্ড ফোকাস দৃশ্যমান রাখো, আইকন-বাটনে `aria-label`, বাটন কমপক্ষে ৪০px উঁচু।

**ডেটা আনা (TanStack Query, সেকশন ৯.২)**

- API ডাকা শুধু `apiFetch` (`src/core/api/client.ts`) দিয়ে।
- Query key সবসময় `createModuleKeys(module)` থেকে: `[module, businessId, entity, …]`।
- Mutation-এর পর শুধু সরাসরি প্রভাবিত key invalidate। filter ছাড়া `invalidateQueries()`/`refetchQueries()`/`resetQueries()` নিষেধ (ESLint)। পুরো পেজ refresh নয়।
- সাইডবার লিংক ডিফল্ট prefetch করে না; শুধু হালকা পেজে `prefetch: 'hover'`। সাইডবার নিজে ডেটা আনে না। একমাত্র ব্যতিক্রম: "অনুমোদন"-এর অপেক্ষমাণ সংখ্যার ব্যাজ (`change.view.all`, ৬০ সেকেন্ড, লুকানো ট্যাবে বন্ধ; DECISIONS.md)।
- তালিকা সবসময় সার্ভার-সাইড ১০ সারি, `<Pagination>` ও `?page=` দিয়ে।

**সেশন ও অনুমতি**

- ব্রাউজার API ডাকে শুধু নিজের সাইটের `/api/v1/*` দিয়ে (Next proxy)। সরাসরি API host নয়; `NEXT_PUBLIC_API_URL` নেই। সার্ভারে `serverApiGet` (`API_INTERNAL_URL`)।
- টোকেন কখনো JavaScript-এ, localStorage-এ বা কোডে নয়; cookie HttpOnly, ব্রাউজার নিজে পাঠায়।
- সুরক্ষিত পেজ `src/app/(app)/` গ্রুপে (লেআউট `requireSession`)। নতুন public পেজ লাগলে `src/proxy.ts`-এর matcher-ও দেখো।
- API-র `Set-Cookie` কখনো পার্স করে নতুন করে বানাবে না; `relaySetCookies` দিয়ে হুবহু পাঠাও।
- `useCan` / `<Can>` / manifest-এর `permission` শুধু দেখানো-লুকানোর সুবিধা; আসল সুরক্ষা API-তে। অনুমতি ছাড়া URL সরাসরি খুললেও 403 পেজ দেখাও।
- ব্যবসার নাম কোডে নয়: নাম, ধরন, রোল `GET /auth/me` থেকে; মেনু module manifest থেকে।
- `next` বা redirect-এর পথ সবসময় `safeNextPath` দিয়ে (বাইরের সাইটে পাঠানো নিষেধ)।

**Settings (`src/core/settings`)**

- ছক শুধু `roles.manage`; ইউজারের তালিকা `users.view`, বাটন `users.manage`। এগুলো UI সুবিধা, আসল সুরক্ষা API-তে।
- পাসওয়ার্ডের নিয়ম শুধু `src/core/auth/password-rules.ts` থেকে। পাসওয়ার্ড কখনো URL, log, query cache বা storage-এ নয়; পাঠানোর পর মুছে ফেলো।
- ত্রুটির বার্তা API-র স্থির `code` দেখে, `useErrorMessage()` / `fieldErrorsOf` (`src/core/api/field-errors.ts`) দিয়ে: ঘরের ত্রুটি ঘরের নিচে, বাকিটা form-এর উপরে; অচেনা code হলে status-এর সাধারণ বার্তা। API-র ইংরেজি `message` কখনো দেখানো নয়। নতুন code → `error-codes.ts` + দুই অনুবাদ ফাইল (`apiErrors`)।
- ঝুঁকির কাজে (মোছা, নিষ্ক্রিয়, রিসেট) `ConfirmDialog`।
- API-র ঘাটতির TODO-গুলো DECISIONS.md-তে; backend ঠিক হলে সেখানে লেখা জায়গায় বদলাও।

**ডিলারশিপ মাস্টার ডেটা (`src/modules/dealership/master-data`)**

- টাকা সবসময় স্ট্রিং (`src/core/lib/money.ts`); কখনো Number-এ বদলে হিসাব নয়।
- লুকানো ফিল্ড: অনুমতি থাকলে **এবং** response-এ ফিল্ড থাকলে তবেই কলাম/ঘর; না হলে জায়গাও রাখবে না।
- তৈরির পরে বাকি/সীমা ও নিষ্ক্রিয় করা মালিক-স্তরের: আলাদা অংশে, কারণ বাধ্যতামূলক, অনুমতি না থাকলে শুধু-পড়ার। মৃত বাটন নয়। পণ্যে কোনো দাম হাতে বসানো নয়: শেষ কেনা-দাম শুধু-পড়া, কেনা থেকে আসে।
- PATCH-এ শুধু বদলানো ঘর।
- তালিকার প্রতিটা সারি/কার্ডে দৃশ্যমান "বিস্তারিত" (`DetailsLink`) আর "কাজ" মেনু (`RowActions`): অনুমতি না থাকলে আইটেম নেই, কোনো আইটেম না থাকলে মেনুই নেই। মুছে ফেলার বাটন নেই, শুধু কারণসহ নিষ্ক্রিয় (DECISIONS.md)।

**কেনা ও স্টক (`src/modules/dealership/{purchases,stock}`)**

- পরিমাণ ও টাকা স্ট্রিং; বস্তা পূর্ণসংখ্যা (এককের `decimals`)। ফর্মে লাইন-মোট ও মোট শুধু দেখানোর জন্য `multiplyMoney`/`sumMoney` (BigInt) দিয়ে; Number-এ হিসাব নয়।
- দাম, লাইন-মোট, মোট ও শেষ কেনা-দাম শুধু উত্তরে থাকলে (`product.cost.view`); না থাকলে কলাম বা জায়গাও নেই।
- কেনা বদলালে `purchases`, `stock`, `products` রিফ্রেশ; সমন্বয়ে শুধু `stock`।
- সরাসরি অনুমতি না থাকলে বাতিল, সংশোধন ও বড় সমন্বয় অনুরোধের মাধ্যমে (core request dialog)।

**অনুমোদন ও সংশোধনের অনুরোধ (`src/core/approvals`)**

- ইনবক্স core-এ; রেকর্ডের পাতা ও অনুমোদনের পর কোন key রিফ্রেশ, তা module manifest-এর `changeEntities`-এ। নতুন রেকর্ডের ধরন এলে সেখানে যোগ করো।
- অনুরোধের বাটন শুধু `change.request` আছে অথচ সরাসরি অনুমতি নেই এমন ইউজারের জন্য; ঘর শুধু যা API পাঠায়। নিজের অনুরোধে অনুমোদন/প্রত্যাখ্যানের বাটন নয়। প্রস্তাবিত মান অনুমোদনকারী বদলাতে পারে না।
- অনুরোধ পাঠাতে Idempotency-Key (dialog খোলার সময় একবার) + ref-guard; ব্যর্থ হলে লেখা মান মুছবে না।

**UI উপাদান**

- পুনর্ব্যবহারযোগ্য উপাদান `src/core/ui`-তে, কোনো ব্যবসার নাম ছাড়া। ডেভ-অনলি পেজ `page.dev.tsx` নামে (production-এ বাদ যায়)।

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
