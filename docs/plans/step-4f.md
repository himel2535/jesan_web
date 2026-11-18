# Step 4f: পণ্যে হাতে বসানো কেনা-দাম সরানো → শুধু-পড়া "শেষ কেনা-দাম"

Branch: `claude/last-purchase-price` (সর্বশেষ `main` থেকে)। Backend: jesan_api #12 (`347f37b`) merge হয়েছে।

## API চুক্তি

- `docs/API.md` backend `main` থেকে হুবহু কপি। মূল বদল:
  - পণ্যে `purchasePrice` নেই; বদলে শুধু-পড়া `lastPurchasePrice` (টাকার স্ট্রিং বা `null`) ও `lastPurchasedAt` (ISO বা `null`)। দুটো সবসময় একসাথে থাকে বা একসাথে `null`।
  - `product.cost.view` না থাকলে ঘর দুটো response-এ আসেই না।
  - তৈরি বা সম্পাদনায় কেনা-দাম পাঠালে 400 `PURCHASE_PRICE_NOT_ALLOWED` / `LAST_PURCHASE_PRICE_NOT_ALLOWED`।
  - `product.price.edit` অনুমতি নেই, তাই মোট অনুমতি ৩৯টা।
  - পণ্যের সংশোধনের অনুরোধে শুধু `isActive`।
  - 409 `CHANGE_REQUEST_PENDING_EXISTS`-এ এখন `changeRequestId` আসে, যদি অনুরোধকারী সেটা খুলতে পারেন।

## বদল

1. `types.ts`: `Product.purchasePrice` সরানো; যোগ `lastPurchasePrice?: string | null`, `lastPurchasedAt?: string | null`।
2. `api.ts`: তৈরি/সম্পাদনার body (`ProductInput`) থেকে `purchasePrice` সরানো।
3. `product-form.tsx`: কেনা-দামের ঘর, তার যাচাই, `useCan('product.price.edit')`, `PriceFields`, `priceChanged`, কারণের ঘর সরানো। সম্পাদনায় থাকবে নাম, ক্যাটাগরি, একক। সক্রিয়/নিষ্ক্রিয় আগের মতোই বিস্তারিত পাতা ও তালিকার "কাজ" মেনুতে।
   - মালিক-স্তরের অংশ সম্পাদনার পাতায় থাকবে শুধু তখন, যখন ইউজার নিষ্ক্রিয় করার অনুরোধ পাঠাতে পারেন।
4. `correction.tsx`: পণ্যের অনুরোধে শুধু নিষ্ক্রিয়/সক্রিয়।
5. `products-list.tsx`: কলাম "শেষ কেনা-দাম" (`lastPurchasePrice`, `null` → "—")।
   - দেখানোর শর্ত: `product.cost.view` **এবং** `'lastPurchasePrice' in p`। ফোনের কার্ডেও একই।
6. `product-detail.tsx`: "শেষ কেনা-দাম" ও "শেষ কেনার তারিখ"। `null` হলে "এখনো কেনা হয়নি"। অনুমতি বা ঘর না থাকলে সারিই নেই।
7. অনুবাদ:
   - `permissions.items.product_price_edit` সরানো; Settings-এর টেস্ট-তালিকা ৪০ → ৩৯; fixture থেকেও।
   - যোগ: "শেষ কেনা-দাম", "শেষ কেনার তারিখ", "এখনো কেনা হয়নি"।
   - `products.purchasePrice` সরানো।
   - `apiErrors`: `PURCHASE_PRICE_NOT_ALLOWED`, `LAST_PURCHASE_PRICE_NOT_ALLOWED` যোগ; `PURCHASE_PRICE_INVALID` সরানো (আর আসে না)। `approvals.fields/impact`-এর `purchasePrice` সরানো।
8. অনুমোদন (core): 409 pending-exists-এ `changeRequestId` থাকলে সরাসরি `/approvals/<id>` লিংক।
   - না থাকলে আগের মতো ফিল্টার করা তালিকা (`change.view.all`) বা শুধু বার্তা।
   - DECISIONS.md-র TODO বন্ধ।
   - `ApiError`-এ body রাখা হবে (`details`), যাতে id পড়া যায়।
9. নকল API (`e2e/mock-api.mjs`):
   - পণ্যে `lastPurchasePrice`/`lastPurchasedAt` (কয়েকটা পণ্যে মান, বাকিগুলো `null`)।
   - `purchasePrice`/`lastPurchasePrice` পাঠালে 400 `*_NOT_ALLOWED`।
   - `product.price.edit` সরানো; পণ্যের অনুরোধে শুধু `isActive`; 409-এ `changeRequestId`।
10. Vitest ও Playwright হালনাগাদ:
    - শেষ কেনা-দাম দেখা/লুকানো, `null` → "এখনো কেনা হয়নি"।
    - ফর্মে কেনা-দামের ঘর নেই, body-তে কিছু যায় না।
    - অনুরোধে শুধু নিষ্ক্রিয়।
    - নতুন code-এর বার্তা দুই ভাষায়।
    - 409-এ সরাসরি লিংক।
11. DECISIONS.md-তে সংক্ষেপে; CLAUDE.md-তে যেখানে "দাম" বলা আছে, সেখানে হালনাগাদ।

## সীমা

- কেনা (Step 5a) এখন নয়। শেষ কেনা-দাম শুধু দেখানো হবে, UI-তে কোনো হিসাব হবে না (টাকা স্ট্রিং)।
