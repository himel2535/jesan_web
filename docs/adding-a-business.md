# নতুন ব্যবসা বা ব্যবসার ধরন যোগ করা

এই ফাইল দুই ভাগে: **frontend** (এই রেপো) আর **backend** (jesan_api; পরে লেখা হবে)।

মূল নিয়ম একটাই: **কোনো ব্যবসার নাম, একক, দাম, পদ্ধতি বা নিয়ম কোডে লেখা হয় না।** সব আসে `GET /auth/me`, module manifest, ব্যবসার Settings বা API-র উত্তর থেকে। একই কোড Akij-এর সিমেন্ট ডিলারশিপ আর অন্য যেকোনো ডিলারশিপে চলে।

## ১. একই ধরনের নতুন ব্যবসা (frontend-এ কিছু করতে হয় না)

একই `type`-এর (যেমন `dealership`) নতুন ব্যবসা backend-এ তৈরি হলে frontend-এ **কোনো কোড লাগে না**:

- ব্যবসার নাম, slug, ধরন ও রোল আসে `GET /auth/me` থেকে; Enterprise Dashboard-এর কার্ড ও topbar-এর switcher নিজে থেকেই দেখায়।
- মেনু আসে সেই ধরনের module manifest থেকে, ইউজারের অনুমতি অনুযায়ী ছাঁকা।
- পণ্যের একক, একক-ভেদে দশমিকের নিয়ম, আদায়ের পদ্ধতি, ক্রেডিট সীমার মোড — সব ব্যবসার Settings থেকে (`GET product-units`, `GET collection-methods`, …)।
- কোডের উপসর্গ (`P-`, `C-`, `ORD-`, `DEL-`, `COL-`) API-র দেওয়া `code`-এই থাকে; frontend কখনো কোড বানায় না।

যাচাই করার তালিকা: ইউজারকে সেই ব্যবসায় রোল দিন, লগইন করুন, সাইডবার ও একেকটা পাতা দেখুন। কোথাও অন্য ব্যবসার নাম বা একক দেখা গেলে সেটা বাগ।

## ২. নতুন ধরনের ব্যবসা (যেমন `manufacturing`) — frontend

১. **Module ফোল্ডার:** `src/modules/<type>/` — শুধু `src/core` ব্যবহার করবে। core কখনো module import করবে না (ESLint আটকায়), এক module অন্য module সরাসরি ডাকবে না।
২. **Manifest** (`src/modules/<type>/manifest.ts`, `ModuleManifest` মেনে):

- `type`: API-র `business.type`-এর হুবহু মান।
- `namespace`: `messages/*.json`-এর namespace; তাতে `typeName` আর প্রতিটা nav key-র লেবেলসহ `nav` থাকতে হবে।
- `nav`: `{ key, path, icon, permission?, prefetch? }`। `path: ''` মানে ব্যবসার ড্যাশবোর্ড। `icon` শুধু `src/core/ui/icons.ts`-এর নাম (নতুন আইকন লাগলে সেখানে যোগ করুন, সাধারণ নামে)। `permission` শুধু দেখানো-লুকানোর সুবিধা।
- `changeEntities`: অনুমোদনের ইনবক্স যে রেকর্ডের ধরন খুলতে পারে — API-র `entityType` → `{ path: 'orders/:id', invalidate: ['orders', …] }`। নতুন রেকর্ডের ধরন এলে এখানে যোগ করা **বাধ্যতামূলক**, নইলে ইনবক্স থেকে রেকর্ডে যাওয়া যায় না আর অনুমোদনের পর ভুল key রিফ্রেশ হয়।
  ৩. **Registry:** `src/modules/registry.ts`-এ manifest যোগ করুন (`type` → manifest)।
  ৪. **অনুবাদ:** `messages/en.json` ও `messages/bn.json`-এ একই key (টেস্ট মেলায়)। লেখা কখনো JSX-এ নয়। `src/core/i18n/client-messages.ts`-এর `CLIENT_NAMESPACES`-এ namespace যোগ করুন, নইলে client component-এ অনুবাদ পৌঁছাবে না।
  ৫. **Route:** `src/app/(app)/b/[slug]/<path>/page.tsx`। প্রতিটা পাতার শুরুতে server-side gate (ডিলারশিপে `dealershipPage(slug, rule)`): ভুল ধরনের ব্যবসা হলে 404, অনুমতি না থাকলে 403 — URL সরাসরি লিখলেও। নির্দিষ্ট route catch-all placeholder-এর আগে মেলে।
  ৬. **Query key:** `createModuleKeys('<type>')` → `[type, businessId, entity, …]`। mutation-এর পর শুধু সরাসরি প্রভাবিত entity invalidate; filter ছাড়া `invalidateQueries()` নিষেধ (ESLint)।
  ৭. **অনুমতি:** নতুন অনুমতি backend-এ এলে `permissions.items.<key underscores>` ও দরকার হলে `permissions.subjects.<subject>` দুই ভাষায় যোগ করুন, আর `test/settings-utils.tsx`-এর তালিকা ও `test/fixtures/me.ts` হালনাগাদ করুন।

## ৩. কী কখনো কোডে নয়

| জিনিস                          | কোথা থেকে আসে                                        |
| ------------------------------ | ---------------------------------------------------- |
| ব্যবসার নাম, ধরন, রোল, অনুমতি    | `GET /auth/me`                                       |
| মেনু ও পাতার তালিকা             | module manifest                                      |
| পণ্যের একক, দশমিকের নিয়ম        | `GET product-units` (`decimals`)                     |
| আদায়ের পদ্ধতি                   | `GET collection-methods`                             |
| ক্রেডিট সীমার মোড, তারিখের সীমা | ব্যবসার Settings (API-র আচরণে)                        |
| কোডের উপসর্গ                    | API-র `code`                                         |
| টাকা, পরিমাণ, তারিখের ফরম্যাট   | `src/core/i18n/format.ts` (`useFormat()`)            |
| এককের নাম বার্তায়               | অনুবাদে `{unit}` প্যারামিটার, মান `product-units` থেকে |

পরিমাণের ঘরের যাচাই সবসময় এককের `decimals` থেকে (`isPositiveQuantity`), আর টাকা সবসময় স্ট্রিং (`src/core/lib/money.ts`); ব্রাউজারে টাকার হিসাব নয় (শুধু দেখানোর জন্য `multiplyMoney`/`sumMoney`, BigInt-এ)।

## ৪. টেস্টে

- প্রতিটা ফর্ম অন্তত দুটো একক-fixture-এ চালান: একটা পূর্ণসংখ্যার একক আর একটা দশমিকের (`src/modules/dealership/sales/fixtures.ts`-এর `WHOLE_UNIT` ও `DECIMAL_UNIT` দেখুন, `describe.each`)। এতে ধরা পড়ে কোথাও একক বা দশমিকের নিয়ম হার্ডকোড হয়েছে কি না।
- নতুন প্রবাহে `e2e/mock-api.mjs`-এ endpoint যোগ করুন (docs/API.md-র রূপ হুবহু: cookie, ত্রুটির `code`, অনুমতি অনুযায়ী লুকানো ফিল্ড)।
- অনুমতি ছাড়া ইউজারের জন্য "বাটন/কলাম/পাতা নেই" — প্রতিটা নতুন পাতায় এই টেস্ট থাকা দরকার।

## ৫. Backend (jesan_api)

পরে লেখা হবে। আপাতত `jesan_api`-র `docs/API.md` আর `docs/plans/` দেখুন; এই রেপোর `docs/API.md` শুধু backend-এর `main` থেকে sync করা কপি, এখানে নিজে বদলানো হয় না।
