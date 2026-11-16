# src/core/api

jesan-api backend-এর সাথে কথা বলার একমাত্র স্তর।

- `config.ts`: `NEXT_PUBLIC_API_URL` থেকে base URL (ডিফল্ট `http://localhost:4000/api/v1`)।
- `client.ts`: `apiFetch<T>(path, options)`: `credentials: 'include'`, ৩ সেকেন্ড timeout, JSON, 401-এ একবার refresh ও একবার আবার চেষ্টা। `setAuthFailureHandler` লগইনের ধাপে redirect বসানোর জায়গা।
- `errors.ts`: সব ত্রুটি `ApiError` (`kind`: `http` | `network` | `timeout`)।
- `query-client.ts`, `query-provider.tsx`: TanStack Query (staleTime ৩০ সেকেন্ড, 4xx-এ retry নয়)।
- `query-keys.ts`: `createModuleKeys(module)`; এক module-এর বদল অন্য module-এর query রিফ্রেশ করে না।
- `health.ts`: সার্ভার থেকে `/health` যাচাই।

নিয়ম: কম্পোনেন্ট সরাসরি `fetch` বা URL বানাবে না; mutation-এর পর শুধু প্রভাবিত key invalidate (সেকশন ৯.২)।
