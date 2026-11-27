# src/modules/dealership

Dealership ধরনের ব্যবসার generic module: নির্দিষ্ট principal supplier থেকে কেনা, দোকানে বেচা, stock, বাকি, commission।

- একটাই module সব ডিলারশিপের জন্য (প্রথমে আকিজ সিমেন্ট, পরে BSRM রড)। কপি-পেস্ট নয়; ব্যবসা-নির্দিষ্ট পার্থক্য (নাম, একক, product, commission নিয়ম, মেনুর লেবেল) আসবে business config থেকে।
- শুধু `src/core` ব্যবহার করবে। অন্য module সরাসরি import করবে না।
- নিজস্ব manifest (sidebar মেনু, permission, dashboard summary) থাকবে; route `/b/[businessSlug]/...`।

- `manifest.ts`: sidebar-এর মেনু (প্রপোজাল ৭-এর ক্রমে), প্রতিটার পথ, আইকন ও প্রয়োজনীয় অনুমতি। লেবেল `messages/*.json`-এর `dealership` namespace-এ। `src/modules/registry.ts` ধরন `dealership`-কে এই manifest-এ মেলায়।

- `master-data/`: পণ্য ক্যাটাগরি, পণ্য, গ্রাহক, সরবরাহকারীর পাতা (API hooks, ফর্ম, তালিকা, টেস্ট)। route ফাইল `src/app/(app)/b/[slug]/{products,customers,suppliers}`। প্রতিটা তালিকায় "বিস্তারিত" আর অনুমতি অনুযায়ী "কাজ" মেনু (`shared/row-actions.tsx`); ক্যাটাগরির বিস্তারিত পাতা `products/categories/[id]`।

- `commission/`: Akij-এর পাওয়া কমিশন: কত টাকা, কবে, কী কারণে (মুক্ত লেখা)। কোনো scheme, target বা হিসাব নেই; পাওয়া টাকা নিট মুনাফায় যোগ হয় (backend)। route `src/app/(app)/b/[slug]/commission`।

- `purchases/`: কেনার তালিকা, নতুন কেনা, বিস্তারিত, বাতিল ও সংশোধন (সরাসরি বা অনুরোধ)। route `src/app/(app)/b/[slug]/purchases`।
- `stock/`: স্টকের তালিকা, পণ্যের স্টক-ইতিহাস, সমন্বয় (সীমা পার হলে অনুরোধ)। route `src/app/(app)/b/[slug]/stock`।
