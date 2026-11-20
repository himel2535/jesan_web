# Step 6-c1: খরচ ও ক্যাশ বই

ব্যাকএন্ড `docs/API.md`-এ নতুন অধ্যায় ১৩ (খরচ, ক্যাশ বই ও রিপোর্ট) যোগ হয়েছে। এই ধাপে শুধু **খরচ** ও
**ক্যাশ বই** বানানো হবে (রিপোর্ট ও দৈনিক সারাংশ পরের ধাপে)। সবকিছু বিদ্যমান `sales/collections` ও
`master-data/categories` প্যাটার্ন অনুসরণ করবে — নতুন কোনো UI উপাদান লাগবে না।

## কাজ

1. **`docs/API.md` sync**: backend main থেকে হুবহু কপি (নিজে সম্পাদনা নয়)।
2. **নতুন error code** (`src/core/api/error-codes.ts` + দুই ভাষায় `apiErrors.codes`): `EXPENSE_METHOD_UNKNOWN`,
   `EXPENSE_CATEGORY_NOT_FOUND_OR_INACTIVE`, `EXPENSE_DATE_INVALID/_IN_FUTURE/_TOO_OLD`, `FROM_INVALID`,
   `TO_INVALID`, `RANGE_TOO_LARGE`, `EXPENSE_NOT_FOUND`, `EXPENSE_CATEGORY_NOT_FOUND`, `EXPENSE_ALREADY_VOID`,
   `NAME_BN_DUPLICATE`।
3. **অনুমতি** (UI সুবিধা): `expense.view/edit/void/category.manage`, `cashbook.view` — `test/settings-utils.tsx`,
   `test/fixtures/me.ts` (owner সব পায়; manager: view/create/category.manage/cashbook.view; accountant:
   view/create/cashbook.view), `permissions.items`/`subjects` দুই ভাষায়।
4. **Manifest**: নতুন nav `expenses` (`expense.view`) ও `cashbook` (`cashbook.view`), `stock`-এর পরে,
   বিদ্যমান `accounts` placeholder-এর আগে (ওটা ভবিষ্যতের সম্মিলিত হিসাব পাতার জন্য, আলাদা অনুমতি —
   touch করা হচ্ছে না)। `changeEntities`-এ `expense`, `expense_category` যোগ। `manifest.test.ts` ও nav
   translation আপডেট।
5. **`src/modules/dealership/expenses/`** (flat module, `purchases/`-এর মতো): `types.ts`, `api.ts`
   (categories/methods/list/detail/create/correct/void + cash-book hook), list page, create form, detail +
   actions (void/correct/request-change), expense-category panel + dialog (`master-data/categories` থেকে
   পোর্ট করা), cash-book view (তারিখ-সীমা, পদ্ধতি অনুযায়ী ভাগ, দিনভিত্তিক পাতাভাগ সারি, শুরুর/শেষ জমা —
   সব API থেকে, frontend হিসাব করবে না)।
6. **Route**: `expenses/{page,new,[id]/page,categories/page,categories/[id]/page}`, `cashbook/page` —
   সবই `dealershipPage(slug, permission)` গেট সহ async server component।
7. **e2e**: `e2e/mock-api.mjs`-এ expense-categories/expense-methods/expenses/cash-book endpoint, নতুন
   `e2e/expenses.spec.ts`।
8. **Test**: প্রতিটা feature-এর সাথে co-located ইউনিট টেস্ট (Akij বস্তা ও দশমিক-একক দুই নমুনা ব্যবসায়
   ব্যবহারযোগ্য ফিক্সচার)।

## গতি

List 10 সারি/পাতা, category তালিকা পাতাভাগ ছাড়া (অল্প সারি, পণ্যের category-র মতো), cash-book-এর দিনগুলো
পাতাভাগসহ। প্রতিটা পেজের একটাই আকার-অনুযায়ী skeleton, `keepPreviousData` + dim। সেভের পর শুধু
`expenses`/`cashBook`/`expenseCategories` invalidate। `expenses` লিস্টে hover prefetch; cash-book-এ নয়
(তারিখ-সীমা ডিফল্ট ক্লায়েন্টে গণনা হয়, prefetch key মেলানো যাবে না)।

## বড় সিদ্ধান্ত

বিদ্যমান `accounts` nav placeholder (permission `ledger.view`) স্পর্শ না করে আলাদা `expenses`/`cashbook`
nav আইটেম — কারণ ভিন্ন অনুমতি ও সুযোগ, নিরাপদ পছন্দ। বিস্তারিত `DECISIONS.md`-তে।
