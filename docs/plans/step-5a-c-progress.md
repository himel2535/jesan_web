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
- [x] অংশ ৩: বাতিল ও সংশোধন (`purchase-actions.tsx`: সরাসরি বাতিল/সংশোধন, নইলে অনুরোধ); `stock-error.ts` (`STOCK_INSUFFICIENT` + উপলব্ধ পরিমাণ); core request dialog-এ quantity/signedQuantity/date/text, `label`, `voidable` (void mode), `initial`
- [x] অংশ ৪: স্টকের তালিকা (`stock-list.tsx`), ইতিহাস (`stock-history.tsx`), সমন্বয় (`adjust-dialog.tsx`; 403 `ADJUSTMENT_APPROVAL_REQUIRED` → একই মানে `product_stock` অনুরোধ); route `stock`, `stock/[productId]`; পণ্যের তালিকায় স্টক (`GET stock`, id দিয়ে মেলানো) ও বিস্তারিতে স্টক + ইতিহাসের লিংক; টেস্ট `stock/stock.test.tsx`
- [x] অংশ ৫: ইনবক্সে মানের ধরন (`kindOfField`/`kindOfImpact`: পরিমাণ, তারিখ, লেখা, টাকা), id-যুক্ত প্রভাবের key prefix দিয়ে অনুবাদ, `items.<id>.*` লেবেল, purchase/product_stock-এর লিংক ও refresh; টেস্ট `core/approvals/inbox.test.tsx`
- [x] অংশ ৬: নকল API (কেনা, স্টক, movements, সমন্বয়, purchase/product_stock অনুরোধ), Playwright `e2e/purchases.spec.ts` (৩টা), DECISIONS.md, CLAUDE.md, module README
- [ ] PR → CI → squash merge
- [ ] তারপর: Mac dev-এর Turbopack ক্যাশ সমস্যা (আলাদা branch, `docs/plans/mac-dev-cache.md`)
