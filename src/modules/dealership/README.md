# src/modules/dealership

Dealership ধরনের ব্যবসার generic module: নির্দিষ্ট principal supplier থেকে কেনা, দোকানে বেচা, stock, বাকি, commission।

- একটাই module সব ডিলারশিপের জন্য (প্রথমে আকিজ সিমেন্ট, পরে BSRM রড)। কপি-পেস্ট নয়; ব্যবসা-নির্দিষ্ট পার্থক্য (নাম, একক, product, commission নিয়ম, মেনুর লেবেল) আসবে business config থেকে।
- শুধু `src/core` ব্যবহার করবে। অন্য module সরাসরি import করবে না।
- নিজস্ব manifest (sidebar মেনু, permission, dashboard summary) থাকবে; route `/b/[businessSlug]/...`।

- `manifest.ts`: sidebar-এর মেনু (প্রপোজাল ৭-এর ক্রমে), প্রতিটার পথ, আইকন ও প্রয়োজনীয় অনুমতি। লেবেল `messages/*.json`-এর `dealership` namespace-এ। `src/modules/registry.ts` ধরন `dealership`-কে এই manifest-এ মেলায়।

এখনো কোনো ফিচার নেই; মেনুর পেজগুলো "শীঘ্রই আসছে"।
