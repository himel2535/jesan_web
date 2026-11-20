# লোডিং: একটাই skeleton, ঝিলিক নেই

Branch: `claude/loving-gauss-htrtz5` (`main` = `7c47d25`; এই পরিবেশে push শুধু এই branch-এ অনুমোদিত, তাই নতুন নামের branch বানানো হয়নি)। নতুন ফিচার নয়।

## সমস্যা

পাতা বদলালে দুই স্তরের skeleton: আগে route-এর `loading.tsx` (শিরোনাম + ৩ কার্ড), তার পরে পাতার নিজের skeleton। একই নেভিগেশনে দুইবার আকার বদলায়।

## বদল

| #   | কী                                                                                                                 | কোথায়                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ১   | route-এর `loading.tsx` দুটোই **বাদ** (Suspense সীমানা সারি মুছে ফেলত); ক্লিকের উত্তর `useLinkStatus`-চালিত ২px CSS বার | `src/core/ui/route-progress.tsx` (নতুন), `src/app/globals.css`, `ui/nav-links.tsx`, `ui/pagination.tsx`                                                                                      |
| ২   | `ListSkeleton` (টুলবার + ১০ সারি), `DetailSkeleton`, `FormSkeleton` core-এ এক জায়গায়; দ্বিতীয় সংজ্ঞা বাদ              | `src/core/ui/skeleton.tsx`; re-export `modules/dealership/sales/skeletons.tsx`, `master-data/shared/states.tsx`; `settings/users-section.tsx`, `approvals/list.tsx`, `approvals/detail.tsx` |
| ৩   | তালিকা placeholder-এ সারি থাকে, শুধু `opacity-60` + `aria-busy`                                                      | ১০টা তালিকা উপাদান (`keepPreviousData` আগেই সব query-তে ছিল)                                                                                                                                |
| ৪   | default `staleTime` ৩০s আগেই ছিল; শুধু `useCategories`-এ ৫ মিনিট                                                     | `master-data/api.ts`                                                                                                                                                                        |
| ৫   | সাইডবারে hover/focus-এ রুট + প্রথম তালিকা-query prefetch (manifest-এ শুধু ডেটা)                                        | `module-system/types.ts`, `navigation/types.ts`, `business-nav.ts`, `ui/nav-links.tsx`, `dealership/manifest.ts`                                                                            |
| ৬   | network/502/503/504-এ ৩ বার retry (4xx-এ ০), timeout ৩s → ১০s, "সার্ভার জাগছে" বার্তা, login-এ retry বাটন            | `api/query-client.ts`, `api/client.ts`, `ui/waking-notice.tsx` (নতুন), `ui/app-shell.tsx`, `auth/ui/login-form.tsx`, `messages/{en,bn}.json`                                                 |
| ৭   | ফর্ম-পাতার দুই ঢেউ → এক ঢেউ (picker-এর query উপরে একবার, একই key)                                                    | `order-form.tsx`, `purchase-form.tsx`, `collection-form.tsx`, `product-edit.tsx`                                                                                                            |

## সিদ্ধান্ত

- `loading.tsx` রাখা হয়নি (বার দিয়েও নয়): ওটা Suspense সীমানা, তাই নিচের পাতা unmount হয় আর `?page=`/ফিল্টার বদলালে সারি মুছে যায় — যা করণীয় ৩-র উল্টো। e2e দিয়ে মেপে দেখা গেছে: সীমানা ছাড়া পুরনো সারি থেকে যায়, শুধু আবছা হয়, আর কোনো skeleton আসে না।
- `DEFAULT_TIMEOUT_MS` ১০s: ৩ সেকেন্ডে ঘুম-ভাঙা Render কখনো উত্তর দেয় না, তাই retry-ও বৃথা হতো। সুস্থ সার্ভারে কিছু বদলায় না।
- সাইডবারের hover prefetch "সাইডবার নিজে ডেটা আনে না" নিয়মের সীমিত ব্যতিক্রম: শুধু hover/focus-এ, শুধু হালকা তালিকা-পাতায়, একটা request।
- টাকা/স্টক/ব্যালেন্সের invalidate সেট অপরিবর্তিত।

## টেস্ট

`loading-shape.test.tsx` (`src/app/**/loading.tsx` আর নেই; skeleton-গুলোর আকার), `query.test.ts` (retry-নীতি), `waking-notice.test.tsx`, `nav-prefetch.test.ts` (manifest key = hook key), `orders.test.tsx`-এ একটাই `aria-busy` ও ফিল্টার বদলে সারি টেকা, `e2e/loading.spec.ts` (`mock_delay` cookie দিয়ে বিলম্ব)।

## এখন নয়

backend লাগবে: products-list-এর আলাদা `GET stock` বাদ দিতে products উত্তরে স্টক; `/sales/new`-এর জন্য সংমিশ্রিত endpoint; units + categories + collection-methods একবারে দেওয়ার `bootstrap` endpoint। (DECISIONS.md-তে তালিকা।)
