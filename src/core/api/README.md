# src/core/api

jesan-api backend-এর সাথে কথা বলার একমাত্র স্তর।

- `config.ts`: `NEXT_PUBLIC_API_URL` থেকে base URL (ডিফল্ট `http://localhost:4000/api/v1`)।
- `health.ts`: `/health` ডেকে backend চলছে কি না জানায়।

নিয়ম: কম্পোনেন্ট সরাসরি URL বানাবে না, এখানকার ফাংশন ব্যবহার করবে। এখন শুধু সাধারণ `fetch`; data-fetching লাইব্রেরি (TanStack Query) পরে যোগ হবে, তখন প্রতিটা module-এর নিজস্ব query-key থাকবে (সেকশন ৯.২)।
