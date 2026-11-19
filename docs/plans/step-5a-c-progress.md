# Step 5a-c অগ্রগতি

Branch: `claude/purchases-stock-ui`। প্ল্যান: `docs/plans/step-5a-c.md`।

## শেষ

- [x] প্ল্যান ফাইল (push হয়েছে)
- [x] অংশ ১: ভিত্তি
  - `docs/API.md` কপি
  - অনুমতি ৪১ (`purchase.edit`, `stock.adjust.large`: লেবেল, fixture, টেস্ট-তালিকা)
  - নতুন ১৫টা ত্রুটি-code (দুই ভাষা)
  - `multiplyMoney`/`sumMoney` (`core/lib/money.ts`) ও `core/lib/quantity.ts`, টেস্টসহ
  - কেনা ও স্টকের types ও hooks (`modules/dealership/{purchases,stock}/{types,api}.ts`)
  - manifest `changeEntities`: `purchase`, `product_stock`
  - `dealership.purchases` ও `dealership.stock` অনুবাদ

## বাকি

- [x] অংশ ২: কেনার তালিকা, নতুন কেনার ফর্ম (`ProductPicker`, BigInt-এ লাইন-মোট, Idempotency-Key), বিস্তারিত, route (`purchases`, `purchases/new`, `purchases/[id]`), `businessToday()`; টেস্ট `purchases/purchases.test.tsx`। `purchase-actions.tsx` এখনো ফাঁকা (অংশ ৩)।
- [ ] অংশ ৩: বাতিল ও সংশোধন (সরাসরি ও অনুরোধ); core request dialog বাড়ানো (quantity/date/text, label, void, আগে বসানো মান)
- [ ] অংশ ৪: স্টকের তালিকা, ইতিহাস, সমন্বয় (সীমা পার হলে অনুরোধ); পণ্যের তালিকা ও বিস্তারিতে স্টক
- [ ] অংশ ৫: ইনবক্সে purchase/product_stock-এর প্রভাব ও ঘরের লেবেল
- [ ] অংশ ৬: নকল API, Playwright, DECISIONS.md, CLAUDE.md; সব চেক, PR, merge
- [ ] তারপর: Mac dev-এর Turbopack ক্যাশ সমস্যা (আলাদা branch, `docs/plans/mac-dev-cache.md`)
