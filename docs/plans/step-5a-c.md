# Step 5a-c: কেনা ও স্টকের পাতা (frontend, ডিলারশিপ module)

Branch: `claude/purchases-stock-ui` (সর্বশেষ `main` থেকে)। Backend: jesan_api Step 5a (#13, `3f75b82`) ও #14 (`e8cd126`) merge হয়েছে।
অগ্রগতি: `docs/plans/step-5a-c-progress.md` (প্রতিটা অংশের পর হালনাগাদ, যাতে নতুন সেশন সেখান থেকে ধরতে পারে)।

## ০. API চুক্তি

- `docs/API.md` backend `main` থেকে হুবহু কপি। অংশের নম্বর বদলেছে: ১০ = কেনা ও স্টক, ১১ = সংশোধনের অনুরোধ, ১২ = ত্রুটি, ১৩ = রোল।
- নতুন অনুমতি `purchase.edit`, `stock.adjust.large`, তাই মোট ৪১টা। দুটোরই দুই ভাষার লেবেল; Settings-এর টেস্ট-তালিকা ৩৯ → ৪১; fixture হালনাগাদ।
- নতুন ত্রুটি-code (দুই ভাষা, "কখন আসে" থেকে):
  - `PURCHASE_NOT_FOUND`, `PURCHASE_ALREADY_VOID`
  - `PRODUCT_DUPLICATE`, `PRODUCT_NOT_FOUND_OR_INACTIVE`
  - `QUANTITY_INVALID`, `UNIT_PRICE_INVALID`
  - `SUPPLIER_NOT_FOUND_OR_INACTIVE`
  - `PURCHASE_DATE_INVALID`, `PURCHASE_DATE_IN_FUTURE`, `PURCHASE_DATE_TOO_OLD`
  - `STOCK_INSUFFICIENT`, `ADJUSTMENT_APPROVAL_REQUIRED`, `ADJUST_BY_INVALID`
  - `NOTE_INVALID`, `SUPPLIER_REFERENCE_INVALID`
- অনুরোধে লেখা code `ADJUSTMENT_NEEDS_APPROVAL` docs-এ নেই; docs-এর আসল code `ADJUSTMENT_APPROVAL_REQUIRED` (403, `details: { limit, usedToday }`) ধরা হবে।

## ১. কাঠামো

- Module-এর ভেতরে `src/modules/dealership/purchases/` ও `src/modules/dealership/stock/`। নিয়ম অনুযায়ী এগুলো শুধু core ব্যবহার করবে; master-data-র shared অংশ (`ListToolbar`, `states`, `display`) একই module-এর বলে চলবে।
- Route:
  - `/b/[slug]/purchases` (`purchase.view`), `/purchases/new` (`purchase.create` + `product.cost.view`), `/purchases/[id]`
  - `/b/[slug]/stock` (`stock.view`), `/stock/[productId]` (স্টক-ইতিহাস)
  - নির্দিষ্ট route catch-all placeholder-এর আগে মেলে। অনুমতি ছাড়া খুললে 403, না থাকলে 404।
- সাইডবারে "কেনা" (`purchase.view`) ও "স্টক" (`stock.view`) manifest-এ আগে থেকেই আছে; শুধু placeholder-এর বদলে আসল পাতা।
- Query key `dealershipKeys`: `purchases`, `stock` (তালিকা ও movements), `products`।
  - কেনা তৈরি, সংশোধন বা বাতিলের পর: `purchases`, `stock`, `products` (শেষ কেনা-দাম বদলায়)।
  - স্টক সমন্বয়ের পর: শুধু `stock`।
- manifest `changeEntities`-এ যোগ:
  - `purchase` → `purchases/:id`, invalidate `['purchases','stock','products']`
  - `product_stock` → `stock/:id`, invalidate `['stock']`
- টাকা ও পরিমাণ সবসময় স্ট্রিং। ফর্মে লাইন-মোট ও মোট দেখানোর জন্য `src/core/lib/money.ts`-এ BigInt দিয়ে দশমিক-স্ট্রিং গুণ ও যোগ (`multiplyMoney`, `sumMoney`; half-up, দুই দশমিক, backend-এর নিয়মের মতো)। শুধু দেখানোর জন্য; সার্ভার আবার হিসাব করে, আর সেভের পর সার্ভারের মানই দেখায়। Number-এ কোনো হিসাব নয়।

## ২. কেনা

- **তালিকা:** ১০টা করে; URL-এ `from`, `to`, `supplierId`, `productId`, `status`, `page`।
  - সারিতে কোড, তারিখ, সরবরাহকারী, লাইন-সংখ্যা, মোট বস্তা, মোট টাকা (শুধু উত্তরে `totalAmount` থাকলে), অবস্থা, কে, আর বিস্তারিত।
  - পণ্যের ফিল্টার পণ্য-খোঁজা দিয়ে, বাছাই করা পণ্য চিপে দেখায় ও মোছা যায়।
  - ফোনে কার্ড। ফাঁকা অবস্থা দুই রকম।
- **নতুন কেনা** (`purchase.create` + `product.cost.view`, না থাকলে বাটন নেই ও পাতায় 403):
  - তারিখ: ডিফল্ট আজ (Asia/Dhaka), `max` আজ।
  - সরবরাহকারী: সক্রিয় তালিকা থেকে, ডিফল্ট প্রিন্সিপাল (`isPrincipal`)। কোডে কোনো নাম নেই।
  - "পণ্য যোগ করুন" খোঁজার বাক্স: সক্রিয় পণ্য, 300ms debounce, ফল বাটনের তালিকা। বাছাই করলে লাইন যোগ হয়; একই পণ্য আবার নয়।
  - প্রতিটা লাইনে পরিমাণ (এককের দশমিক নিয়মে; বস্তা পূর্ণসংখ্যা), একক কেনা-দাম, লাইন-মোট (দেখানোর জন্য), আর "বাদ দিন" বাটন। লাইন ১–৫০টা।
  - মোট বস্তা ও মোট টাকা দেখানো হবে। নোট (৫০০ অক্ষর) ও কাগজের নম্বর (`supplierReference`, ৬৪ অক্ষর)।
  - Idempotency-Key পাতা খোলার সময় একবার; ref-guard দিয়ে দুবার জমা ঠেকানো। ব্যর্থ হলে লেখা মুছবে না।
  - ত্রুটি `split`-এ ঘরের নিচে: `items.<n>.quantity` বা `unitPrice` বা `productId` সেই লাইনের নিচে; `purchaseDate`, `supplierId`, `note`, `supplierReference` নিজের ঘরে।
  - সফল হলে বিস্তারিত পাতায়, সাথে "সেভ হয়েছে" বার্তা।
- **বিস্তারিত:** কোড, তারিখ, সরবরাহকারী, কাগজের নম্বর, নোট, কে ও কবে, অবস্থা; বাতিল হলে কারণ, কে ও কবে।
  - লাইনের টেবিলে পণ্য, পরিমাণ, দাম, লাইন-মোট। দাম ও মোট শুধু উত্তরে থাকলে; না থাকলে কলামই নেই।
  - পণ্যের নাম স্টক-ইতিহাসে লিংক।
- **বাতিল ও সংশোধন** (বিস্তারিত পাতার কাজ; বাতিল হওয়া কেনায় কিছুই নয়):
  - **সরাসরি বাতিল** (`purchase.void`): কারণসহ `ConfirmDialog` → `POST purchases/:id/void`।
  - **সরাসরি সংশোধন:** একটা dialog, যেখানে ঘর দেখায় অনুমতি অনুযায়ী।
    - তারিখ ও লাইনের পরিমাণ: `purchase.edit`। লাইনের দাম: `purchase.edit` + `product.cost.view`। নোট ও কাগজের নম্বর: `purchase.create`।
    - তারিখ, পরিমাণ বা দাম বদলালে কারণ বাধ্যতামূলক। PATCH-এ শুধু বদলানো ঘর।
  - **অনুরোধ** (`change.request`, সরাসরি অনুমতি নেই): 4d-র core request dialog বাড়ানো হবে। বাতিলের অনুরোধ (`kind: void`) ও সংশোধনের অনুরোধ (`purchaseDate`, `items.<id>.quantity`, `items.<id>.unitPrice` (দাম দেখার অনুমতি থাকলে), `note`, `supplierReference`)। কারণ ৩–৫০০, preview দেখিয়ে তবেই পাঠানো।
  - **`STOCK_INSUFFICIENT`:** স্পষ্ট বার্তা, `details.available` থেকে উপলব্ধ পরিমাণসহ ("স্টকে আছে মাত্র ৪২ বস্তা")। সংশোধনে সংশ্লিষ্ট লাইনের নিচে।
- core request dialog-এর বাড়তি অংশ (সাধারণ, কোনো ব্যবসার নাম নেই):
  - ঘরের ধরন `quantity` (চিহ্ন ছাড়া, এককের দশমিক), `signedQuantity`, `date`, `text`।
  - প্রতি ঘরে ঐচ্ছিক `label` (লাইনের পণ্যের নাম দিয়ে), ঐচ্ছিক `decimals`।
  - target-এ `voidable` ("বাতিলের অনুরোধ" বাছলে `kind: void`, `proposedChange` নয়)।
  - আগে থেকে বসানো মান ও কারণ (স্টক সমন্বয় থেকে আসার জন্য)।

## ৩. স্টক

- **তালিকা:** ১০টা করে; খোঁজা, ক্যাটাগরি, অবস্থা।
  - সারিতে কোড, নাম, ক্যাটাগরি, বর্তমান স্টক (`format.quantity` + এককের নাম)।
  - শেষ কেনা-দাম ও তারিখ শুধু উত্তরে থাকলে (`product.cost.view`); বিক্রয়কর্মী শুধু পরিমাণ দেখেন।
  - কাজ: "ইতিহাস" লিংক, "সমন্বয়" (`stock.adjust`)।
- **স্টক-ইতিহাস** `/stock/[productId]`:
  - উপরে পণ্য ও বর্তমান স্টক। ফিল্টার `from`, `to`, `kind` (URL-এ)।
  - সারিতে তারিখ, ধরন, চিহ্নসহ পরিমাণ, পরের স্টক (`balanceAfter`), উৎস (`PUR-0042` → কেনার পাতায় লিংক), কারণ, কে।
- **সমন্বয় dialog** (`stock.adjust`): চিহ্নসহ পরিমাণ (শূন্য নয়, এককের নিয়মে) ও কারণ ৩–৫০০।
  - 403 `ADJUSTMENT_APPROVAL_REQUIRED` এলে সীমা ও আজ ব্যবহৃত পরিমাণসহ বার্তা।
  - `change.request` থাকলে "অনুমোদনের জন্য অনুরোধ পাঠান"। এটা একই পরিমাণ ও কারণ বসানো অবস্থায় core request dialog খোলে (`entityType: product_stock`, `adjustBy`)। না থাকলে শুধু বার্তা।
  - সফল হলে শুধু `stock` রিফ্রেশ।
- **পণ্যের পাতায় স্টক:**
  - বিস্তারিত পাতা (`stock.view`): বর্তমান স্টক `GET stock/:id/movements` থেকে, সাথে "স্টক-ইতিহাস" লিংক।
  - পণ্যের তালিকা (`stock.view`): "বর্তমান স্টক" কলাম। একই ফিল্টারে `GET stock` ডাকা হয়, যার ক্রম ও খোঁজা backend-এ পণ্যের তালিকার মতোই; মেলানো হয় id দিয়ে। না মিললে "—"।

## ৪. অনুমোদন ইনবক্স (4d) হালনাগাদ

- `purchase` ও `product_stock`-এর লিংক manifest থেকে।
- প্রভাবের লাইনের key-তে id থাকে: `stock.<productId>`, `purchase.totalAmount`, `lastPurchasePrice.<productId>`, `purchaseCounter.<YYYY-MM>`। অনুবাদ হবে key-র প্রথম অংশ দিয়ে ("স্টক", "শেষ কেনা-দাম", "মাসে কেনা বস্তা")। পরিচয়ের অংশ (পণ্যের কোড বা মাস) API-র লেবেলের শেষ শব্দ থেকে নেওয়া হবে। অচেনা হলে API-র লেবেল।
- পরিমাণের মান (`unit` থাকলে) টাকা নয়, পরিমাণ হিসেবে দেখানো।
- ঘরের লেবেল:
  - `purchaseDate`, `note`, `supplierReference`, `adjustBy` অনুবাদ থেকে।
  - `items.<id>.quantity` / `unitPrice` → "লাইনের পরিমাণ" / "লাইনের দাম", সাথে লাইনের ছোট পরিচয়।
- বাতিলের অনুরোধ আগের মতো "বাতিলের অনুরোধ" দেখায়।

## ৫. টেস্ট

- **Vitest** (Testing Library, axe, দুই ভাষা, কীবোর্ড):
  - অনুমতিভেদে বাটন ও পাতা; দাম লুকানো (উত্তরে না থাকলে কলামও নেই)।
  - নতুন কেনার ফর্ম: লাইন যোগ/বাদ, ডুপ্লিকেট পণ্য নয়, পরিমাণ ও দামের যাচাই, লাইন-মোট ও মোট (BigInt), দুবার জমা না হওয়া, Idempotency-Key একই থাকা, ব্যর্থতায় মান থাকা, লাইনের ঘরে ত্রুটি।
  - সরাসরি বাতিল ও সংশোধন; `STOCK_INSUFFICIENT`-এ উপলব্ধ পরিমাণ।
  - অনুরোধের প্রবাহ (বাতিল ও সংশোধন)।
  - স্টক তালিকা ও ইতিহাস; সমন্বয় ও সীমা পার হলে অনুরোধ।
  - পণ্যের তালিকা ও বিস্তারিতে স্টক; ইনবক্সে purchase ও product_stock-এর প্রভাব ও লিংক।
  - money-র গুণ ও যোগ; নতুন code-এর দুই ভাষার বার্তা; ঠিক key-ই invalidate।
- **Playwright** (নকল API-তে purchases, stock, movements, adjustments, change-requests-এর purchase/product_stock):
  - ম্যানেজার কেনা তৈরি করেন → স্টক বাড়ে → বাতিলের অনুরোধ → মালিক ব্যাজ দেখে অনুমোদন করেন → স্টক কমে, কেনা "বাতিল"।
  - সীমার বেশি সমন্বয় → অনুরোধের পথ।
  - দুই থিম ও দুই ভাষায় পাতা খোলে।

## ৬. এখন নয়

অর্ডার, ডেলিভারি, আদায় (5b), কমিশন ও কেনার কাউন্টার (`purchase-counters`, Step 7c), খাতা, Accounts।

## স্বয়ংক্রিয় সিদ্ধান্ত: পর্যালোচনা দরকার

মালিক অনুপস্থিত, তাই নিরাপদ ও ফেরানো-যায় এমন পথ নেওয়া হয়েছে:

1. **ত্রুটি-code:** `ADJUSTMENT_NEEDS_APPROVAL`-এর বদলে docs-এর `ADJUSTMENT_APPROVAL_REQUIRED`।
2. **পণ্যের তালিকায় স্টক:** `GET products`-এ `currentStock` নেই, তাই দ্বিতীয় অনুরোধ `GET stock` (একই ফিল্টার ও ক্রম, id দিয়ে মেলানো)। খরচ: তালিকার পাতায় একটা বাড়তি অনুরোধ (১০ সারি)। ভালো সমাধান হলো backend পণ্যের উত্তরে `currentStock` যোগ করা; এলে বদলাব (DECISIONS.md-তে TODO)।
3. **পণ্যের বিস্তারিতে স্টক:** movements-এর প্রথম পাতা থেকে।
4. **লাইন-মোট ও মোট:** ফর্মে BigInt দিয়ে শুধু দেখানো। সার্ভারের উত্তরই চূড়ান্ত।
5. **ইনবক্সে লাইনের লেবেল:** `items.<id>.quantity`-এ পণ্যের নাম নেই (API দেয় না)। "লাইনের পরিমাণ" + id-র শেষ ৪ অক্ষর দেখানো হবে। প্রভাবের স্টক-লাইনে পণ্যের কোড থাকে, তাতে বোঝা যায়।
6. **প্রভাবের লেবেল:** id-যুক্ত key prefix দিয়ে অনুবাদ, পরিচয় API-র লেবেলের শেষ শব্দ থেকে।
7. **আজকের তারিখ:** ব্রাউজারে `Intl` দিয়ে Asia/Dhaka-তে হিসাব (`format.ts`-এর মতো)। ভুল হলেও সার্ভার আটকায় (`PURCHASE_DATE_IN_FUTURE`)।
8. **সরবরাহকারীর তালিকা:** নতুন কেনার ফর্মে `GET suppliers?active=true` প্রথম পাতা (১০টা)। ডিলারশিপে সরবরাহকারী সাধারণত ১–২টা। বেশি হলে পরে খোঁজা যোগ হবে।
9. **কেনার তালিকায় পণ্যের ফিল্টার:** খোঁজা দিয়ে বাছাই করা পণ্য URL-এ `productId`। চিপে পণ্যের নাম পরের লোডে API থেকে আনা হবে না; চিপে লেখা থাকবে "একটা পণ্য"। বাছাইয়ের সময় নাম জানা থাকলে নাম দেখাবে।
