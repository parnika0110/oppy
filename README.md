# OPPY

Never miss an opportunity because you found it too late.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `MONGODB_URI` — from MongoDB Atlas
   - `OPENAI_API_KEY` — from platform.openai.com
   - `ADMIN_SECRET` — any long random string, used to gate admin APIs
   - `CRON_SECRET` — a separate long random string, required for scheduled ingestion
3. In MongoDB Atlas, create these indexes on the `opportunities` collection:
   ```js
   db.opportunities.createIndex({ deadline: 1 })
   db.opportunities.createIndex({ category: 1 })
   db.opportunities.createIndex({ isActive: 1, deadline: 1 })
   db.opportunities.createIndex({ title: "text", description: "text", organization: "text" })
   ```
4. `npm run dev` → visit `http://localhost:3000`
5. Go to `/admin`, paste your `ADMIN_SECRET`, and add your first opportunity — AI enrichment runs automatically.

## Deploy to Vercel
1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add the same env vars (`MONGODB_URI`, `MONGODB_DB`, `OPENAI_API_KEY`, `ADMIN_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` = your production URL) in Vercel's Project Settings → Environment Variables.
4. Deploy. Vercel builds and serves the Next.js app directly — no extra config needed.
