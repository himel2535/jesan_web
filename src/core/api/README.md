# src/core/api

jesan-api-র সাথে কথা বলার একমাত্র স্তর। চুক্তি: `docs/API.md`।

- `config.ts`: ব্রাউজারের জন্য `BROWSER_API_BASE = '/api/v1'` (নিজের সাইট, Next proxy করে); সার্ভারের জন্য `serverApiBaseUrl()` = `API_INTERNAL_URL` (ডিফল্ট `http://localhost:4000/api/v1`)।
- `client.ts` (ব্রাউজার): `apiFetch<T>(path, options)`: `credentials: 'include'`, ৩ সেকেন্ড timeout, JSON। 401-এ একসাথে একটাই refresh, তারপর একবার আবার চেষ্টা (refresh ব্যর্থ হলেও, অন্য ট্যাবের জন্য); তাতেও 401 হলে `/login`-এ। `login`/`refresh`/`logout`-এ refresh নয়।
- `server.ts` (সার্ভার): `serverApiGet<T>(path)`: আসা অনুরোধের `jesan_at` cookie API-তে পাঠায়। Server Component cookie বসাতে পারে না, তাই এখানে refresh নেই।
- `errors.ts`: সব ত্রুটি `ApiError` (`kind`, `status`, `code`, `retryAfterSeconds`, `isServerUnavailable`)। ইউজারকে বার্তা `status` দেখে অনুবাদ ফাইল থেকে, API-র `message` লেখা থেকে নয়।
- `query-client.ts`, `query-provider.tsx`, `query-keys.ts`: TanStack Query ও module-ভিত্তিক key।
- `health.ts`: সার্ভার থেকে `/health` (লগইন পেজের স্ট্যাটাস)।

নিয়ম: কম্পোনেন্ট সরাসরি `fetch` বা URL বানাবে না; mutation-এর পর শুধু প্রভাবিত key invalidate (সেকশন ৯.২)।
