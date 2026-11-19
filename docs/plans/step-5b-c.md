# Step 5b-c: অর্ডার, ডেলিভারি, আদায় ও গ্রাহকের খাতা (frontend, ডিলারশিপ module)

Branch: `claude/laughing-fermi-l80kpu` (সর্বশেষ `main` = `90b71f2` থেকে; এই পরিবেশে push শুধু এই branch-এ অনুমোদিত, তাই নতুন নামের branch বানানো হয়নি — রিপোর্টে উল্লেখ)।
Backend: jesan_api `main` (`feec536`, Step 5b #15) merge হয়েছে।
অগ্রগতি: `docs/plans/step-5b-c-progress.md` (প্রতিটা অংশের পর হালনাগাদ, যাতে নতুন সেশন সেখান থেকে ধরতে পারে)।

## ০. API চুক্তি

- `docs/API.md` backend `main` (`feec536`) থেকে হুবহু কপি। অংশের নম্বর: ১০ = কেনা ও স্টক, **১১ = অর্ডার, ডেলিভারি ও আদায়**, ১২ = সংশোধনের অনুরোধ, ১৩ = ত্রুটি, ১৪ = রোল ও অনুমতি।
- নতুন অনুমতি (মোট ৪১ → ৫০): `sale.edit`, `sale.void`, `delivery.view`, `delivery.create`, `delivery.edit`, `delivery.void`, `delivery.credit.override`, `collection.edit`, `collection.void`। (`sale.create`, `sale.view.all`, `sale.view.own`, `collection.create`, `collection.view` আগে থেকেই ঘোষিত।) দুই ভাষায় লেবেল; Settings-এর টেস্ট-তালিকা ও `test/fixtures/me.ts` হালনাগাদ।
- backend-এর `docs/plans/step-5b.md` অংশ ৭-এর ১৪টা স্বয়ংক্রিয় সিদ্ধান্ত UI-তে মেনে চলা হয়েছে; নিচের "backend-এর সিদ্ধান্ত UI-তে" দেখুন।

### নতুন ত্রুটি-code (`src/core/api/error-codes.ts` + দুই অনুবাদ ফাইলে `apiErrors.codes`)

`ORDER_NOT_FOUND`, `DELIVERY_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `CUSTOMER_NOT_FOUND_OR_INACTIVE`,
`DELIVER_BY_INVALID`, `DELIVERY_WINDOW_INVALID`,
`ORDER_DATE_INVALID`, `ORDER_DATE_IN_FUTURE`, `ORDER_DATE_TOO_OLD`,
`DELIVERY_DATE_INVALID`, `DELIVERY_DATE_IN_FUTURE`, `DELIVERY_DATE_TOO_OLD`,
`COLLECTION_DATE_INVALID`, `COLLECTION_DATE_IN_FUTURE`, `COLLECTION_DATE_TOO_OLD`,
`ORDER_ITEM_NOT_FOUND`, `ORDER_ITEM_DUPLICATE`, `DELIVERY_QUANTITY_TOO_LARGE`, `ORDER_QUANTITY_TOO_SMALL`,
`COLLECTION_METHOD_UNKNOWN`, `AMOUNT_TOO_SMALL`, `AMOUNT_INVALID`,
`TRANSPORT_REFERENCE_INVALID`, `REFERENCE_INVALID`,
`CREDIT_LIMIT_EXCEEDED`, `ORDER_ALREADY_VOID`, `DELIVERY_ALREADY_VOID`, `COLLECTION_ALREADY_VOID`, `DELIVERY_EXISTS`।

`details` থাকা তিনটা code-এর আলাদা, তথ্যসহ বার্তা (কেনার `STOCK_INSUFFICIENT`-এর মতো হুক):

- `DELIVERY_QUANTITY_TOO_LARGE` → `details.remaining`: "এই লাইনে আর মাত্র {remaining} বাকি"
- `STOCK_INSUFFICIENT` → `details.available`: বিদ্যমান `useStockInsufficientMessage()` পুনর্ব্যবহার (`purchases/stock-error.ts` → `sales/`-এ import)
- `CREDIT_LIMIT_EXCEEDED` → `details.creditLimit`, `details.balanceAfter`: "ক্রেডিট সীমা {creditLimit}, এই ডেলিভারির পরে বাকি হতো {balanceAfter}"

## ১. কাঠামো

নতুন folder `src/modules/dealership/sales/` (শুধু core + একই module-এর master-data shared ব্যবহার করে):

| ফাইল                                                                                                         | কী                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `types.ts`                                                                                                   | `Order`, `OrderSummary`, `OrderItem`, `Delivery`, `DeliverySummary`, `Collection`, `LedgerPage`, ফিল্টার ও input টাইপ, `SALES_LIMITS` |
| `api.ts`                                                                                                     | query hooks, `dealershipKeys`-ভিত্তিক key, refresh-সেট                                                                                |
| `shared.tsx`                                                                                                 | `CustomerPicker` (debounce খোঁজা), `useBusinessDate`, `StatusBadge`-গুলো, `DateRangeFilters`, `CreditWarning`                          |
| `orders/orders-list.tsx`, `order-form.tsx`, `order-detail.tsx`, `order-actions.tsx`                          | অর্ডার                                                                                                                                |
| `deliveries/deliveries-list.tsx`, `delivery-form.tsx`, `delivery-detail.tsx`, `delivery-actions.tsx`         | ডেলিভারি                                                                                                                             |
| `collections/collections-list.tsx`, `collection-form.tsx`, `collection-detail.tsx`, `collection-actions.tsx` | আদায়                                                                                                                                 |
| `customer/ledger.tsx`, `customer/customer-activity.tsx`, `customer/customer-tabs.tsx`                        | গ্রাহকের খাতা ও ইতিহাস                                                                                                                |
| `orders.test.tsx`, `deliveries.test.tsx`, `collections.test.tsx`, `ledger.test.tsx`                          | টেস্ট                                                                                                                                 |

### Route (সব `src/app/(app)/b/[slug]/…`, server guard `dealershipPage(slug, rule)`)

| পথ                                          | অনুমতি (server gate)                                              |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `sales`                                     | `{ anyOf: ['sale.view.all', 'sale.view.own'] }`                  |
| `sales/new`                                 | `sale.create`                                                    |
| `sales/[id]`                                | `{ anyOf: ['sale.view.all', 'sale.view.own'] }`                  |
| `deliveries`                                | `delivery.view`                                                  |
| `deliveries/new` (`?orderId=`)              | `delivery.create`                                                |
| `deliveries/[id]`                           | `delivery.view`                                                  |
| `collections`                               | `collection.view`                                                |
| `collections/new` (`?customerId=&orderId=`) | `collection.create`                                              |
| `collections/[id]`                          | `collection.view`                                                |
| `customers/[id]` (বিদ্যমান)                  | `customer.view`                                                  |
| `customers/[id]/ledger`                     | `customer.due.view`                                              |
| `customers/[id]/activity`                   | `{ anyOf: ['sale.view.all', 'sale.view.own', 'delivery.view'] }` |

অনুমতি ছাড়া URL সরাসরি খুললে 403 পাতা (`Forbidden`), ব্যবসা না থাকলে 404 — বিদ্যমান নিয়ম।
বিক্রয়কর্মী `deliveries` মেনু বা পাতা পান না (সিদ্ধান্ত ৯); নিজের অর্ডারের বিস্তারিততে ডেলিভারির সারাংশ দেখেন (API-র `order.deliveries`)।

### Manifest (`src/modules/dealership/manifest.ts`)

- `nav`-এ `sales`-এর পরে দুটো নতুন এন্ট্রি:
  - `{ key: 'deliveries', path: 'deliveries', icon: 'truck', permission: 'delivery.view' }`
  - `{ key: 'collections', path: 'collections', icon: 'wallet', permission: 'collection.view' }`
    (`suppliers` আগে থেকেই `truck`, `accounts` আগে থেকেই `wallet` — আইকন ভাগ করা চলে; নতুন আইকন নয়।)
- `changeEntities`-এ তিনটা নতুন ধরন:
  - `sales_order` → `sales/:id`, invalidate `['orders','deliveries','customers','ledger']`
  - `delivery` → `deliveries/:id`, invalidate `['deliveries','orders','stock','customers','ledger']`
  - `collection` → `collections/:id`, invalidate `['collections','customers','ledger']`

### Query key ও invalidate (`createModuleKeys('dealership')`)

Entity: `orders`, `deliveries`, `collections`, `collection-methods`, `ledger`, সাথে বিদ্যমান `customers`, `products`, `stock`।

| কাজ                            | invalidate                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| অর্ডার তৈরি                     | `orders`, `customers` (ডেলিভারি-বাকি বস্তা বাড়ে)                                                          |
| অর্ডার সংশোধন / বাতিল           | `orders`, `deliveries`, `customers`, `ledger` (দাম বদলালে আগের ডেলিভারির মূল্য ও খাতাও বদলায় — সিদ্ধান্ত ১০) |
| ডেলিভারি তৈরি / সংশোধন / বাতিল | `deliveries`, `orders`, `stock`, `customers`, `ledger`                                                   |
| আদায় তৈরি / সংশোধন / বাতিল     | `collections`, `customers`, `ledger`                                                                     |
| অনুমোদনের পর                    | উপরের তালিকা manifest-এর `changeEntities` থেকে                                                           |

`products` কখনো নয় (বিক্রিতে পণ্যের ডেটা বদলায় না)। filter ছাড়া invalidate কোথাও নয়।

## ২. অর্ডার

- **তালিকা** (`GET orders`): ১০টা করে, URL-এ `status`, `customerId`, `from`, `to`, `page`। `placeholderData: keepPreviousData` — ফিল্টার/পাতা বদলালে আগের সারি থেকে যায়, শুধু `opacity-60` + `aria-busy`।
  - কলাম: কোড, তারিখ, গ্রাহক, মোট বস্তা, বাকি বস্তা, মোট টাকা (শুধু উত্তরে `totalAmount` থাকলে), ডেলিভারির অবস্থা, অবস্থা, কে, "বিস্তারিত"।
  - মোবাইলে কার্ড (বিদ্যমান `useIsDesktop` প্যাটার্ন)।
  - `status` ড্রপডাউন: সব / `open` / `pending` / `partial` / `delivered` / `void`।
  - গ্রাহকের ফিল্টার `CustomerPicker` দিয়ে, বাছাই করা গ্রাহক চিপে, মোছা যায় (কেনার পণ্য-ফিল্টারের মতো)।
  - সারি/কার্ডে hover ও focus-এ `router.prefetch(detailHref)` (তালিকা থেকে বিস্তারিতে)।
- **নতুন অর্ডার** (`sale.create`):
  - গ্রাহক: `CustomerPicker` (শুধু সক্রিয়; নিষ্ক্রিয় গ্রাহকে নতুন অর্ডার নয় — সিদ্ধান্ত ৮)।
  - জরুরিতা (`deliveryWindow`): `today` / `two_days` / `one_week`, API-র স্থির তালিকা, লেবেল অনুবাদে। ঐচ্ছিক `deliverBy` (তারিখ, অর্ডারের দিনের পরে বা সমান)।
  - একাধিক পণ্য-লাইন: `ProductPicker` (কেনা থেকে core-মুক্তভাবে পুনর্ব্যবহার), প্রতি লাইনে পরিমাণ (এককের `decimals`) ও দাম। **দাম প্রতি অর্ডার-লাইনে আলাদা; কেনা-দামের সঙ্গে কোনো তুলনা বা সতর্কতা নয়** (প্রপোজাল ও নির্দেশ অনুযায়ী)।
  - লাইন-মোট ও মোট শুধু দেখানোর জন্য `multiplyMoney` / `sumMoney` (BigInt)। Number-এ কোনো হিসাব নয়।
  - ঐচ্ছিক নোট (৫০০)।
  - **অগ্রিম আদায় একই ফর্মে** (চেকবক্স, শুধু `collection.create` থাকলে): পরিমাণ + পদ্ধতি + রেফারেন্স। অর্ডার তৈরি হওয়ার পরে দ্বিতীয় কল `POST collections` (`orderId` সহ), নিজস্ব Idempotency-Key। আদায় ব্যর্থ হলে অর্ডার টেকে: বিস্তারিত পাতায় গিয়ে "অর্ডার হয়েছে, কিন্তু আদায় হয়নি: …" + "আদায় নিন" লিংক (টাকা দুবার বসার চেয়ে নিরাপদ)।
  - ফর্ম খোলার সময় একটাই Idempotency-Key + `inFlight` ref-guard; ব্যর্থ হলে লেখা মান থাকে, ঘরের ত্রুটি ঘরের নিচে।
- **বিস্তারিত** (`GET orders/:id`): সারাংশ, লাইন (পরিমাণ / ডেলিভারি-হওয়া / বাকি / দাম / লাইন-মোট — দাম শুধু উত্তরে থাকলে), ডেলিভারির অগ্রগতি (`order.deliveries` সারাংশের তালিকা; `delivery.view` থাকলে প্রতিটায় লিংক), এই অর্ডারের আদায় (`GET collections?orderId=`, শুধু `collection.view`), বাতিলের ব্যানার।
  - বাটন: "ডেলিভারি দিন" (`delivery.create`, অর্ডার সক্রিয় ও বাকি > ০), "সংশোধন" (`sale.edit`), "বাতিল" (`sale.void`), "সংশোধনের অনুরোধ" (`change.request` আছে অথচ সরাসরি অনুমতি নেই — বিদ্যমান `RequestChangeButton`)।
  - বাতিলের ত্রুটি `DELIVERY_EXISTS` → "আগে এই অর্ডারের ডেলিভারিগুলো বাতিল করুন"।

## ৩. ডেলিভারি

- **তৈরি** (`delivery.create`, `deliveries/new?orderId=`): অর্ডারের লাইনগুলো দেখায়, প্রতি লাইনে "এবার কত" (ডিফল্ট ফাঁকা; "সব বাকি বসাও" বাটন)। **আংশিক ডেলিভারি চলে**: শূন্য/ফাঁকা লাইন বাদ যায়, অন্তত একটা লাইন লাগে।
  - ক্লায়েন্ট-যাচাই: > ০, এককের `decimals`, লাইনের `remainingQuantity`-র বেশি নয়।
  - ঐচ্ছিক `transportReference` (৬৪), নোট।
  - ত্রুটি স্পষ্টভাবে: `STOCK_INSUFFICIENT` → লাইনের নিচে "স্টকে আছে মাত্র {available} {unit}"; `DELIVERY_QUANTITY_TOO_LARGE` → "আর মাত্র {remaining} বাকি"; `CREDIT_LIMIT_EXCEEDED` (block মোড) → ফর্মের উপরে সীমা ও হতো-বাকি সহ, আর `delivery.credit.override` থাকলে "তবুও দিন" নয় — API নিজেই override ধরে, তাই বার্তা শুধু জানানোর।
  - সফল হয়ে `creditLimitExceeded: true` এলে (warn মোড) বিস্তারিত পাতায় হলুদ সতর্কবার্তা — শুধু উত্তরে ফিল্ডটা থাকলে (`customer.due.view`)।
  - Idempotency-Key + ref-guard।
- **তালিকা** (`delivery.view`): ফিল্টার `orderId`, `customerId`, `status`, `from`, `to`, `page`। কলাম: কোড, তারিখ, অর্ডার, গ্রাহক, মোট বস্তা, মোট টাকা (উত্তরে থাকলে), অবস্থা, কে।
- **বিস্তারিত**: লাইন, অর্ডারের লিংক, গ্রাহকের লিংক, পরিবহনের রেফারেন্স, বাতিলের ব্যানার।
  - বাটন: "সংশোধন" (`delivery.edit`), "বাতিল" (`delivery.void`), নইলে "সংশোধনের অনুরোধ" (`entityType: 'delivery'`, ঘর `deliveryDate`, `transportReference`, `note`, `items.<id>.quantity`, আর `kind: 'void'`)।

## ৪. আদায়

- **ফর্ম** (`collection.create`): গ্রাহক (`CustomerPicker`, **নিষ্ক্রিয় গ্রাহকও চলে** — সিদ্ধান্ত ৮, তাই `active: 'all'`), পরিমাণ, পদ্ধতি (`GET collection-methods` থেকে — কোডে কোনো পদ্ধতির নাম নয়; লেবেল `dealership.collections.methods.<key>`, অজানা key হলে `useDynamicT` fallback-এ key নিজেই), ঐচ্ছিক রেফারেন্স (৬৪), তারিখ, নোট।
  - "কোন অর্ডারের বিপরীতে" ঐচ্ছিক: গ্রাহক বাছার পরে তার সক্রিয় অর্ডারের তালিকা; খালি রাখলে সাধারণ অগ্রিম। সাহায্য-লেখা: "অর্ডারে বরাদ্দ হয় না; শুধু রেফারেন্স।"
  - পাওনার বেশি আদায় চলে (ঋণাত্মক ব্যালেন্স = অগ্রিম) — কোনো বাধা নয়।
  - Idempotency-Key + ref-guard।
- **তালিকা** (`collection.view`): ফিল্টার `customerId`, `orderId`, `method`, `status`, `from`, `to`, `page`। কলাম: কোড, তারিখ, গ্রাহক, পদ্ধতি, টাকা, অর্ডার, অবস্থা, কে।
- **বিস্তারিত**: সব ঘর + "সংশোধন" (`collection.edit`), "বাতিল" (`collection.void`), নইলে "সংশোধনের অনুরোধ" (`entityType: 'collection'`, ঘর `collectionDate`, `method`, `amount`, `reference`, `note`, আর `kind: 'void'`)।
- **অগ্রিম ফেরত:** অর্ডার বাতিলের dialog-এ লেখা থাকবে "এই অর্ডারের আদায় আপনা থেকে ফেরত যায় না; অগ্রিম গ্রাহকের জমা থাকে। টাকা ফেরত দিলে সেই আদায় আলাদা করে বাতিল করুন।" (সিদ্ধান্ত ৩)।

## ৫. গ্রাহকের প্রোফাইল

`customers/[id]` এখন tab: **বিস্তারিত** | **খাতা** (`customer.due.view`) | **অর্ডার ও ডেলিভারি** (`sale.view.*` বা `delivery.view`)। যে tab-এর অনুমতি নেই তা নেই; একটার কম হলে tab-বার নেই (বিদ্যমান `TabNav`)।

- **খাতা** (`GET customers/:id/ledger?from=&to=&page=`): উপরে সারাংশ কার্ড — শুরুর বাকি, ডেলিভারির মোট, আদায়ের মোট, **চলমান ব্যালেন্স** (ঋণাত্মক হলে বিদ্যমান `<Balance>` "অগ্রিম" ব্যাজে), ক্রেডিট সীমা। সবই API-র সংখ্যা; frontend কিছু হিসাব করে না।
  - সারি: তারিখ, ধরন (`delivery`, `delivery_edit`, `delivery_void`, `collection`, `collection_edit`, `collection_void` — অনুবাদ), উৎসের কোড (ডেলিভারি/আদায়ের পাতার লিংক, অনুমতি থাকলে), চিহ্নসহ টাকা (ধনাত্মক = পাওনা বাড়ে, লাল/সবুজ নয় — চিহ্ন ও লেবেল), কারণ, কে।
  - তারিখ ফিল্টার `from`/`to`, পাতাভাগ ১০।
  - খাতায় শুরুর বাকির সারি নেই (API-র নিয়ম); সারাংশে আছে।
- **অর্ডার ও ডেলিভারির ইতিহাস**: একই পাতায় দুটো অংশ — `GET orders?customerId=` আর (অনুমতি থাকলে) `GET deliveries?customerId=`, দুটোরই নিজস্ব পাতাভাগ ও একই `from`/`to`।
- গ্রাহকের তালিকা ও বিস্তারিতে নতুন ঘর: `pendingDeliveryQuantity` (সবাই), `deliveredAmount` ও `collectedAmount` (শুধু উত্তরে থাকলে)। নতুন ফিল্টার নয় (সিদ্ধান্ত ১৪)।

## ৬. অনুমোদন ইনবক্স ও অনুরোধ dialog

- `changeEntities`-এ তিনটা নতুন ধরন (উপরে)।
- `approvals.entityTypes`-এ `sales_order`, `delivery`, `collection`-এর নাম; `approvals.fields`-এ `orderDate`, `deliveryWindow`, `deliverBy`, `deliveryDate`, `collectionDate`, `transportReference`, `method`, `amount`, `reference`; `approvals.impact`-এ `order.totalAmount`, `order.remainingQuantity`, `customer.pendingDeliveryQuantity`, `customer.currentBalance`।
- `display.tsx`-এর `kindOfField` বাড়ানো: `*Date` শেষ হলে তারিখ; `amount` টাকা; `transportReference`, `reference`, `method`, `deliveryWindow` লেখা; `remainingQuantity`, `pendingDeliveryQuantity` পরিমাণ।
- প্রভাব-preview বিদ্যমান `POST change-requests/preview` দিয়েই — নতুন কিছু নয়, শুধু লেবেল।
- নিজের অনুরোধে অনুমোদন/প্রত্যাখ্যানের বাটন নেই (বিদ্যমান আচরণ)।

## ৭. অনুমতি-ম্যাপ (UI দেখানো-লুকানো; আসল সুরক্ষা API-তে)

| দেখা/কাজ                                      | অনুমতি                                        |
| --------------------------------------------- | -------------------------------------------- |
| অর্ডার মেনু ও তালিকা                            | `sale.view.all` বা `sale.view.own`           |
| "নতুন অর্ডার"                                   | `sale.create`                                |
| অর্ডার সংশোধন / বাতিল                          | `sale.edit` / `sale.void`                    |
| ডেলিভারি মেনু, তালিকা, বিস্তারিত                | `delivery.view`                              |
| "ডেলিভারি দিন"                                | `delivery.create`                            |
| ডেলিভারি সংশোধন / বাতিল                       | `delivery.edit` / `delivery.void`            |
| আদায় মেনু, তালিকা, বিস্তারিত                    | `collection.view`                            |
| "আদায় নিন", অগ্রিমের অংশ                       | `collection.create`                          |
| আদায় সংশোধন / বাতিল                           | `collection.edit` / `collection.void`        |
| খাতা tab, ব্যালেন্স, ক্রেডিট সীমা, ক্রেডিট-সতর্কতা | `customer.due.view` **এবং** উত্তরে ফিল্ডটা আছে |
| দাম, লাইন-মোট, মোট                            | শুধু উত্তরে ফিল্ডটা থাকলে (কলামই তৈরি হয় না)     |
| "সংশোধনের অনুরোধ"                              | `change.request` আছে, সরাসরি অনুমতি নেই       |

কমিশন ও কেনা-দাম এই পাতাগুলোতে দেখানোই হয় না (API পাঠায় না)। মৃত বাটন নেই: অনুমতি না থাকলে আইটেম বাদ, কোনো আইটেম না থাকলে মেনুই নেই।

## ৮. গতি ও মসৃণতা

- প্রতিটা পাতায় **একটাই** skeleton, পাতার আসল কাঠামোর আকারে: তালিকায় টুলবার + ১০ সারি, বিস্তারিতে হেডার + সারাংশ + লাইন-টেবিল। দুই স্তরের skeleton বা সাদা পর্দা নয় (route-এর `loading.tsx` বিদ্যমান; নতুন পাতাগুলো একই গ্রুপে)।
- তালিকায় `placeholderData: keepPreviousData`; ফিল্টার বদলালে আগের তথ্য থাকে, ঝিলিক নেই।
- খোঁজা ৩০০ ms debounce (`CustomerPicker`, `ProductPicker`), সার্ভার-পাতাভাগ ১০।
- তালিকা → বিস্তারিত: সারিতে `onMouseEnter` / `onFocus`-এ `router.prefetch`। সাইডবার ডিফল্টে prefetch করে না (বিদ্যমান নিয়ম)।
- মেনুর পরের পাতা idle-এ prefetch: অর্ডারের তালিকায় `requestIdleCallback`-এ `sales/new` (হালকা ফর্ম)। ভারী পাতায় নয়।
- সব বাটনে `disabled` + `aria-busy` + `inFlight` ref: ডাবল-সাবমিট বন্ধ।
- সেভের পর শুধু উপরের টেবিলের key invalidate; পুরো পাতা refresh নয়।
- টেবিল ও লম্বা তালিকার উপরে `glass`/blur নয় (বিদ্যমান নিয়ম)।

## ৯. ভাষা, একক ও সাধারণ নকশা

- কোনো লেখা JSX-এ নয়: নতুন namespace `dealership.orders`, `dealership.deliveries`, `dealership.collections`, `dealership.ledger`, সাথে `dealership.nav.deliveries` / `.collections`। দুই ফাইলে একই key (টেস্ট যাচাই করে)। `dealership` আগে থেকেই `CLIENT_NAMESPACES`-এ।
- **কোথাও Akij, সিমেন্ট বা "বস্তা" হার্ডকোড নয়।** এককের নাম সবসময় `GET product-units` থেকে, অনুবাদে প্যারামিটার: `"quantityWithUnit": "{quantity} {unit}"`, `"quantityLabel": "পরিমাণ ({unit})"`, `"stockShort": "স্টকে আছে মাত্র {available} {unit}"`। কোডের উপসর্গ (`ORD-`, `DEL-`, `COL-`) API থেকেই আসে।
- পরিমাণের ঘরের যাচাই এককের `decimals` থেকে (`isPositiveQuantity`), `inputMode` `numeric`/`decimal` সেই অনুযায়ী।
- আদায়ের পদ্ধতি ও জরুরিতার তালিকা ডেটা/`docs/API.md`-র enum থেকে; কোডে কোনো ব্যবসার নাম নেই।
- টাকা সবসময় স্ট্রিং; `format.money` / `format.quantity` / `format.date` ছাড়া কিছু নয়।
- টোকেন ক্লাস ছাড়া রঙ নয়; বাটন ≥ ৪০px; আইকন-বাটনে `aria-label`; ফোকাস দৃশ্যমান।

## ১০. backend-এর ১৪টা সিদ্ধান্ত UI-তে

| #   | UI-তে কী                                                                                  |
| --- | ----------------------------------------------------------------------------------------- |
| ১   | `sale.*` অনুমতি ব্যবহার; `order.*` নামে কিছু নেই                                             |
| ২   | খাতা আলাদা পাতা, `balance_after` নেই বলে সারিতে "চলমান ব্যালেন্স" কলাম **নেই**; সারাংশে মোট |
| ৩   | অর্ডার বাতিলের dialog-এ "আদায় ফেরত যায় না" লেখা; আদায় বাতিলের আলাদা পথ                     |
| ৪   | ক্রেডিট-সতর্কতা শুধু নতুন ডেলিভারিতে; সংশোধনে নয়                                               |
| ৫   | `CREDIT_LIMIT_EXCEEDED` (৪০৯, `field: items`) ফর্মের উপরে, সীমা ও হতো-বাকি সহ              |
| ৬   | ব্যালেন্স বদলে গ্রাহকের অপেক্ষমাণ অনুরোধ stale হয় না — UI-তে কিছু করার নেই                      |
| ৭   | অর্ডারের সব ঘরের সরাসরি সংশোধন `sale.edit`-এ (নোট ও সময়সীমা সহ)                            |
| ৮   | নতুন অর্ডারে শুধু সক্রিয় গ্রাহক; ডেলিভারি ও আদায়ে নিষ্ক্রিয়ও চলে (`active: 'all'`)                |
| ৯   | বিক্রয়কর্মী ডেলিভারির মেনু/পাতা পান না; অর্ডারের ভেতরে সারাংশ দেখেন                           |
| ১০  | ডেলিভারির মূল্য অর্ডারের দামে — আলাদা দাম-ঘর নেই                                             |
| ১১  | সংশোধনে লাইন যোগ/বাদ নেই; dialog-এ শুধু বিদ্যমান লাইনের পরিমাণ                               |
| ১২  | এক ডেলিভারি এক অর্ডারের: ডেলিভারি ফর্ম সবসময় `orderId` নিয়ে                                 |
| ১৩  | দৈনিক সারাংশ ও Accounts এই ধাপে নয়                                                        |
| ১৪  | গ্রাহকের তালিকায় নতুন ফিল্টার নয়, শুধু সারাংশ কলাম                                             |

## ১১. টেস্ট

**Unit (vitest, `test/utils.tsx`-এর renderer):**

- `orders.test.tsx`: তালিকা রেন্ডার ও ফিল্টার URL-এ; মোট-টাকার কলাম উত্তরে না থাকলে নেই; নতুন-অর্ডার ফর্মে লাইন যোগ, লাইন-মোট ও মোট, ভুল পরিমাণে ঘরের ত্রুটি, ডাবল-সাবমিটে একটাই POST; `sale.create` ছাড়া "নতুন অর্ডার" বাটন নেই; বিস্তারিতে `sale.void`/`sale.edit` ছাড়া বাটন নেই কিন্তু `change.request`-এ অনুরোধ বাটন আছে; বাতিলে `DELIVERY_EXISTS`-এর বার্তা।
- `deliveries.test.tsx`: আংশিক ডেলিভারি (এক লাইন ফাঁকা), বাকির বেশি দিলে ক্লায়েন্ট-ত্রুটি, `STOCK_INSUFFICIENT` ও `DELIVERY_QUANTITY_TOO_LARGE`-এর তথ্যসহ বার্তা, `creditLimitExceeded` সতর্কতা শুধু ফিল্ড থাকলে।
- `collections.test.tsx`: পদ্ধতির তালিকা API থেকে (কোডে নেই), অর্ডার ছাড়াই অগ্রিম, পাওনার বেশি আদায়ে বাধা নেই, `COLLECTION_METHOD_UNKNOWN` ঘরের নিচে।
- `ledger.test.tsx`: ঋণাত্মক চলমান ব্যালেন্স "অগ্রিম" লেবেলে; সারির ধরনগুলোর অনুবাদ; তারিখ ফিল্টার query-তে; `customer.due.view` ছাড়া tab নেই।
- **রুল ৩:** প্রতিটা ফর্ম-টেস্ট দুটো একক-fixture-এ চলে — `bag` (`decimals: 0`, Akij-ধরনের) আর শুধু-টেস্টের `tonne` (`decimals: 3`): পূর্ণসংখ্যা বনাম দশমিক যাচাই, `inputMode`, আর এককের নাম প্যারামিটার হিসেবে বসে কি না (`describe.each`)।
- বিদ্যমান টেস্ট হালনাগাদ: manifest (নতুন nav ও changeEntities), permission-groups (৫০টা অনুমতি), i18n key-সমতা, error-code সমতা।

**E2E (Playwright, `e2e/sales.spec.ts`; `e2e/mock-api.mjs`-এ নতুন endpoint):**

1. ম্যানেজার: অর্ডার বানান (দুই লাইন) → তালিকায় দেখা যায় → বিস্তারিতে লাইন ও বাকি।
2. ম্যানেজার: সেই অর্ডারে আংশিক ডেলিভারি → অর্ডারের অবস্থা `partial`, স্টক কমে।
3. ম্যানেজার: স্টকের বেশি ডেলিভারি → স্পষ্ট ত্রুটি, কিছু বদলায় না।
4. ম্যানেজার: আদায় নেন (অর্ডারের বিপরীতে) → গ্রাহকের খাতায় দুই সারি, চলমান ব্যালেন্স মিলছে।
5. ম্যানেজার: পাওনার বেশি আদায় → খাতায় "অগ্রিম" লেবেল।
6. বিক্রয়কর্মী: সাইডবারে ডেলিভারি ও আদায় নেই; `/deliveries` সরাসরি খুললে 403; নিজের অর্ডার দেখেন।
7. ম্যানেজার (সরাসরি অনুমতি নেই) অর্ডার বাতিলের অনুরোধ পাঠান → মালিক ইনবক্সে প্রভাব দেখে অনুমোদন করেন → অর্ডার `void`।

## ১২. docs

- `docs/API.md`: backend থেকে হুবহু কপি (নিজে সম্পাদনা নয়)।
- `DECISIONS.md`: এই ধাপের সিদ্ধান্তগুলো।
- `CLAUDE.md`: "বিক্রি, ডেলিভারি ও আদায়" অনুচ্ছেদ (নিয়মের সারাংশ)।
- **`docs/adding-a-business.md`: রেপোতে নেই — এই PR-এ তৈরি হবে**, frontend অনুচ্ছেদসহ (নতুন ব্যবসার ধরন যোগ করতে manifest, nav, changeEntities, অনুবাদ namespace, একক ও config কোথা থেকে, কী কখনো হার্ডকোড নয়)।

## ১৩. এখন নয়

দৈনিক সারাংশ, Accounts, কমিশন, রিপোর্ট, গ্রাহকের statement প্রিন্ট/PDF, ডেলিভারি-চালান প্রিন্ট।

## স্বয়ংক্রিয় সিদ্ধান্ত: পর্যালোচনা দরকার

মালিক অনুপস্থিত, তাই সবচেয়ে নিরাপদ বিকল্প বেছে নেওয়া হলো। সব ফেরানো যায়।

1. **Branch:** এই পরিবেশে push শুধু `claude/laughing-fermi-l80kpu`-এ অনুমোদিত, তাই CLAUDE.md-র "কাজের নামে নতুন branch" মানা যায়নি। branch-টা `main`-এর সমান থেকে শুরু হয়েছে, কাজের নামে নয়।
2. **ডেলিভারি ও আদায়ের নতুন মেনু-এন্ট্রি** manifest-এ যোগ (`deliveries`, `collections`)। বিকল্প ছিল অর্ডারের ভেতরে লুকিয়ে রাখা, কিন্তু তালিকা ও ফিল্টার তখন পাওয়া যেত না। আইকন বিদ্যমান দুটোই (`truck`, `wallet`) পুনর্ব্যবহার।
3. **অগ্রিম আদায় অর্ডারের ফর্মে দুই কলে** (অর্ডার → আদায়)। API-তে একসাথে পাঠানোর পথ নেই। আদায় ব্যর্থ হলে অর্ডার থাকে আর স্পষ্ট বার্তা দেখায় — টাকা দুবার বসার চেয়ে নিরাপদ।
4. **জরুরিতার তালিকা** (`today`/`two_days`/`one_week`) API-র স্থির enum থেকে, কোনো config endpoint নেই। লেবেল অনুবাদে; নতুন মান এলে `useDynamicT` fallback-এ key দেখায়, পাতা ভাঙে না।
5. **খাতার সারিতে "চলমান ব্যালেন্স" কলাম নেই** (backend সিদ্ধান্ত ২: `balance_after` রাখা হয়নি, শুরুর বাকি সংশোধনে পুরনো সংখ্যা ভুল হতো)। সারাংশে এখনকার ব্যালেন্স আছে। frontend নিজে যোগ করে সারি-ভিত্তিক ব্যালেন্স বানাবে না।
6. **`delivery.credit.override`-এর আলাদা বাটন নেই**: API অনুমতি দেখে নিজেই ডেলিভারি সম্পন্ন করে। দুবার-নিশ্চিত করার dialog ভুল করে সীমা পার করানোর ঝুঁকি বাড়াত না, কিন্তু মৃত/বিভ্রান্তিকর বাটনও নয় — তাই শুধু সতর্কবার্তা।
7. **গ্রাহকের প্রোফাইলে tab** (বিস্তারিত / খাতা / অর্ডার ও ডেলিভারি) আলাদা route-এ, এক পাতায় সব নয়: প্রতিটার নিজের পাতাভাগ ও তারিখ-ফিল্টার দরকার, আর অনুমতি অনুযায়ী আলাদা করে লুকানো সহজ।
8. **`docs/adding-a-business.md` নতুন করে তৈরি** (রেপোতে ছিল না)। শুধু frontend অনুচ্ছেদ লেখা হয়েছে; backend অংশ পরে।
9. **টেস্টের দশমিক-একক `tonne` (decimals 3)** শুধু টেস্ট-fixture; কোনো বাস্তব ব্যবসার ডেটা বা নাম কোডে নেই।
