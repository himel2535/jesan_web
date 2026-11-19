# Mac dev: Turbopack-এর "Cannot find module" ত্রুটি

## সমস্যা

Mac-এ (macOS 12.7.6) `npm run dev` চালালে মাঝে মাঝে Turbopack এই ত্রুটি দেখায়:

- `Cannot find module 'tapable'`
- আগে: `'@vercel/turbopack/postcss'`

প্রতিবার `rm -rf .next node_modules && npm ci` করলে ঠিক হয়।

## কারণ

- Next 16-এ dev-এর Turbopack **স্থায়ী ক্যাশ** ডিফল্ট চালু (`turbopackFileSystemCacheForDev: true`), রাখা হয় `.next/dev/cache/turbopack`-এ। এতে module-এর resolve করা পথও জমা থাকে।
- `tapable` কোনো সরাসরি dependency নয়। এটা আসে এই পথে: `@tailwindcss/postcss` → `@tailwindcss/node` → `enhanced-resolve` → `tapable`। Turbopack PostCSS (Tailwind) চালায় তার নিজের Node worker-এ, ক্যাশের পথ ধরে।
- `npm ci`/`npm install` (নতুন branch, `git pull`, প্যাকেজ বদল), Next-এর ভার্সন বদল বা Node বদলালে `node_modules`-এর বিন্যাস বদলায়। কিন্তু পুরনো ক্যাশ তখনো পুরনো পথ ধরে রাখে। ফলে "module পাওয়া যায়নি"। `@vercel/turbopack/postcss` হলো Next-এর ভেতরের PostCSS loader; Next-এর ভার্সন বদলের পর একই কারণে হারায়।
- শুধু `node_modules` নয়, `.next` মুছলেই ঠিক হয়। এতেই বোঝা যায় দোষ ক্যাশের।
- `package-lock.json`-এ `tapable` ঠিকঠাক আছে (`node_modules/tapable`, enhanced-resolve-এর dependency); lockfile-এ সমস্যা নেই।

## সমাধান (নিরাপদ, কম ঝুঁকির)

- **`predev` → `scripts/dev-cache-guard.mjs`:** `npm run dev`-এর আগে নিজে থেকে চলে।
  - fingerprint বানায় এগুলো দিয়ে: `package-lock.json`, ইনস্টল করা Next-এর ভার্সন, Node-এর ভার্সন, OS, CPU।
  - আগের dev চালানোর সাথে না মিললে শুধু `.next/dev` মোছে (dev-এর output ও Turbopack ক্যাশ)।
  - fingerprint রাখা হয় `.next/.dev-deps-stamp`-এ। কিছু না বদলালে ক্যাশ থাকে, dev দ্রুত থাকে।
- **`npm run dev:clean`:** যেকোনো সময় জোর করে dev ক্যাশ মুছে চালানো।
- **`npm run dev:webpack`:** Turbopack-এ তবুও সমস্যা হলে webpack দিয়ে dev (ধীর, কিন্তু Turbopack ক্যাশ ব্যবহার করে না)।
- **যা বদলায়নি:** `next build`, `next start`, CI, Vercel, production। `next.config.ts`-এ কোনো বদল নেই। `.next`-এর build output (`.next/server`, `.next/static`, `.next/cache`) guard কখনো ছোঁয় না।

## বাদ দেওয়া বিকল্প

- **dev ডিফল্ট `--webpack`:** সব সময় ধীর, আর CI/production Turbopack-এ চলে, তাই dev আর production আলাদা হয়ে যেত।
- **`turbopackFileSystemCacheForDev: false`:** প্রতিবার ঠান্ডা শুরু, সবার dev ধীর। ক্যাশের সুবিধা হারায়, অথচ সমস্যা হয় শুধু dependency বদলালে।
- **প্রতিবার `predev`-এ পুরো `.next` মোছা:** প্রতি dev চালানোয় ঠান্ডা শুরু, আর build output-ও যায়।

## Mac-এ যাচাই

```bash
git pull && npm ci
npm run dev        # প্রথমবার: "[dev-cache-guard] ... cleared .next/dev" দেখাবে
```

এরপর কিছু না বদলালে বার্তা আসবে না, ক্যাশ থাকবে। branch বদলে `npm ci` করলে আবার একবার মুছবে। ত্রুটি আবার এলে `npm run dev:clean`, তারপরও এলে `npm run dev:webpack`, আর কোন ধাপে এসেছে জানান।
