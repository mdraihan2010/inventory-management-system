# StockPilot: ইনভেন্টরি ও বিক্রি ব্যবস্থাপনা

একটি ইনভেন্টরি, বিক্রি ও ক্রয় ব্যবস্থাপনা সিস্টেম। এতে পণ্য, স্টক, বিক্রি, পরিশোধ, বাকি, ক্রয়, রিপোর্ট এবং ব্যবহারকারীর ভূমিকা ভিত্তিক অনুমতি আছে।

## প্রযুক্তি

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express 5, Mongoose 9, JWT, bcryptjs
- **Database:** MongoDB Atlas
- **Deploy:** Frontend Vercel, Backend Render

## মূল সুবিধা

- পণ্য, ক্যাটাগরি ও ব্র্যান্ড ব্যবস্থাপনা
- স্টক, স্টক ইতিহাস ও কম স্টকের সতর্কতা
- ক্রয়: খসড়া, সম্পন্ন (স্টক বাড়ে) ও বাতিল
- বিক্রি: খসড়া, সম্পন্ন (স্টক কমে, ক্রয়মূল্য সংরক্ষিত হয়) ও বাতিল
- পরিশোধ (আংশিক বা সম্পূর্ণ) ও বাকির হিসাব
- গ্রাহক ও সরবরাহকারী ব্যবস্থাপনা
- রিপোর্ট: বিক্রি, ক্রয়, লাভ ও স্টক মূল্য
- ব্যবহারকারী ও ভূমিকা: Administrator, Manager, Staff
- Audit log: গুরুত্বপূর্ণ পরিবর্তনের রেকর্ড

## ভূমিকা ও অনুমতি

| কাজ | Administrator | Manager | Staff |
|---|---|---|---|
| বিক্রি তৈরি, সম্পন্ন, পরিশোধ নেওয়া | ✅ | ✅ | ✅ |
| বিক্রি বাতিল | ✅ | ✅ | ❌ |
| ক্রয় তৈরি, সম্পন্ন, বাতিল | ✅ | ✅ | ❌ |
| গ্রাহক যোগ | ✅ | ✅ | ✅ |
| গ্রাহক সম্পাদনা ও চালু/বন্ধ | ✅ | ✅ | ❌ |
| সরবরাহকারী যোগ ও সম্পাদনা | ✅ | ✅ | ❌ |
| রিপোর্ট ও পরিশোধের তালিকা | ✅ | ✅ | ❌ |
| ব্যবহারকারী ব্যবস্থাপনা ও Audit log | ✅ | ❌ | ❌ |

## Local-এ চালানো

প্রয়োজন: Node.js ও pnpm।

**1. Frontend**

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

এরপর `http://localhost:3000` খুলুন।

**2. Backend**

```bash
cd server
pnpm install
cp .env.example .env
pnpm dev
```

`.env`-এ `MONGO_URI` ও `JWT_SECRET` নিজের মান দিয়ে বদলান। Backend চালু হলে `http://localhost:5000/api/v1/health` খুললে একটি বার্তা আসবে।

## প্রথম Administrator তৈরি

`server` ফোল্ডারে থেকে:

```bash
node src/scripts/createAdmin.js "আপনার নাম" admin@example.com "শক্তিশালী-password"
```

Password কমপক্ষে ৮ অক্ষরের হতে হবে। এই কমান্ড শুধু একবার চালান।

## Deploy

- **Frontend (Vercel):** Environment variable `NEXT_PUBLIC_API_BASE_URL` যোগ করুন, তারপর Redeploy করুন।
- **Backend (Render):** Root Directory `server`, Build Command `pnpm install`, Start Command `pnpm start`। Environment variables: `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL` (Vercel-এর ঠিকানা)।

Render-এর বিনামূল্যের সার্ভার কিছুক্ষণ ব্যবহার না হলে ঘুমিয়ে যায়। প্রথম request-এ ২-৩ মিনিট লাগতে পারে।

## জানা সীমাবদ্ধতা

- সরবরাহকারীকে টাকা পরিশোধের অংশ এখনো নেই।
- Administrator অন্য ব্যবহারকারীর password রিসেট করতে পারে না।
- খুচরা বিক্রিতে বাকি রাখলে গ্রাহক সংরক্ষিত থাকে না।
- তারিখভিত্তিক রিপোর্ট UTC অনুযায়ী হিসাব হয়। বাংলাদেশের সকাল ৬টার আগের বিক্রি তাই আগের দিনে যেতে পারে।
- প্রতিটি browser tab-এ আলাদা login লাগে (token `sessionStorage`-এ থাকে)।

## প্রজেক্টের কাঠামো

app/ Next.js পাতা ও layout
components/ প্রতিটি মডিউলের পাতা (products, sales, customers ইত্যাদি)
lib/ API client (api.ts)
server/src/
config/ MongoDB সংযোগ
controllers/ ব্যবসার যুক্তি
middleware/ login ও ভূমিকা যাচাই
models/ Mongoose schema
routes/ API পথ
scripts/ প্রথম admin তৈরি
utils/ audit log

