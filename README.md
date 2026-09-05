# OPPY — Opportunity Discovery Platform

> Good opportunities shouldn't be this hard to find.

OPPY discovers real opportunities from across the web — internships, jobs, hackathons, fellowships, events, grants, and scholarships — and matches them to what you're looking for. It is built for students and early-career users.

## Features

- **Browse & discover** — public opportunity feed with category, location, remote, skill/interest, experience, and search filters, plus a "recommended" relevance ranking. No login required to browse, view detail pages, or visit application links.
- **Saved opportunities** — bookmark opportunities to a personal Saved list (auth-gated).
- **Application tracking** — track application status ("Interested", applied, interview, offer, etc.) from cards and detail pages (auth-gated).
- **Personalized dashboard** — category-balanced "Recommended for you" matches, recent activity, and saved/tracked summaries for signed-in users.
- **Similar opportunities** — related opportunities on detail pages.
- **Recently viewed** — history of opportunities you opened.
- **AI / natural-language search** — interpret natural-language queries and voice input via Sarvam AI (optional).
- **Resume upload** — attach and store a resume on your profile.
- **Email/password auth + Google OAuth** with password reset and logout confirmation.
- **Opportunity ingestion** — automated pipeline that ingests, normalizes, dedupes, quality-filters, and lifecycles opportunities from many sources.
- **Social metadata** — dynamic OG/Twitter metadata and a 1200×630 launch image for link previews.

## Tech Stack

- **Framework:** Next.js 15 (App Router, React 19) + TypeScript
- **Database:** MongoDB (canonical data store)
- **Auth:** custom bcrypt email/password + Google OAuth, server-side DB-backed sessions
- **Email:** EmailJS (password-reset codes, reminders)
- **AI:** Sarvam AI (natural-language/voice), OpenAI (optional)
- **Ingestion:** source adapters + normalization; deployed as an AWS Lambda (Node.js 24)
- **Styling:** Tailwind CSS + custom editorial design system
- **Testing:** Vitest
- **Deployment:** AWS Amplify (web) + AWS Lambda (ingestion)

## Architecture

```
Landing Page → Browse / Discovery (public)
     ↓
Opportunity detail (public) → Save / Track / Similar / Recently viewed (auth-gated)
     ↓
Dashboard / Saved / Profile (auth-gated, personalized)
```

### Data flow

```
Source pages/APIs
  → ingestion adapters (per-source parsers)
  → normalization + quality filters + dedup
  → MongoDB (opportunities)
  → API routes
  → OpportunityCard / detail page
```

Opportunity discovery, viewing, and applying are **public**. Save, Track, personalized recommendations, profile/preferences, resume, and dashboard are **auth-gated**.

## Authentication

- **Email/password:** bcrypt-hashed passwords stored in the `users` collection; verified server-side.
- **Sessions:** DB-backed sessions (`sessions` collection) with an `oppy_session` httpOnly cookie. No session state in client code.
- **Google OAuth:** server-side OAuth flow with callback route; Google-created accounts have no password until one is set via "Forgot password".
- **Password reset:** emailed one-time reset codes stored in `passwordResets` (expiry + one-time use). The API returns the same generic response whether or not an account exists (no account enumeration).
- **Admin:** separate admin login guarded by `ADMIN_SECRET` HMAC-signed session tokens; cron endpoints guarded by `CRON_SECRET`.

### MongoDB collections

`users`, `sessions`, `opportunities`, `savedOpportunities`, `applicationTracking`, `recentlyViewed`, `passwordResets`, `ingestionRuns`, `discoveryRuns`, `discoveryCandidates`, `reminderLog`, `sourceRegistry`

## Opportunity Ingestion & Sources

The pipeline (`lib/ingestion/`) runs source adapters, normalizes each opportunity into a consistent model, dedupes by `sourceId`, applies quality filters, and handles lifecycle/staleness (inactive closure, deadline handling).

Active adapters include: **Internshala**, **JSearch** (via OpenWeb Ninja), **Hacker News**, **LinkedIn / Indeed / Glassdoor / Wellfound** (site-scoped), **Eventbrite**, **Devpost**, **Devfolio**, **MLH-style programs**, **Luma**, **Naukri**, **RemoteOK**, **YC Work at a Startup**, **Unstop**, **RSS feeds**, **GitHub programs**, and static/curated programs.

Key quality rules:

- **Internshala** — structured extraction of start date, duration, stipend (currency + range + `/month` unit preserved), deadline, work mode ("Work from home" → Remote), internship/part-time type, organization, posted date (`sourcePublishedAt`), `isRemote`, and the full source description.
- **Hacker News** — "Who is hiring?" comments are not blindly ingested: comments must meet an early-career quality threshold, must not bundle unrelated senior roles, and HN discussion URLs are never treated as application URLs. Stale monthly content is closed after `HN_MAX_AGE_DAYS` from first sight.
- **JSearch** — a student-focused query plan (6 core early-career queries × India + one rotating international market, plus Bengaluru/remote India anchors) = **14 requests/cycle**, capped by `JSEARCH_MAX_REQUESTS_PER_RUN` (default 16). A conservative seniority filter drops obvious senior-only roles (Senior/Staff/Principal/Director/Lead/…) unless an explicit early-career signal is present (e.g. "Senior Software Engineer Intern" is kept). A per-family lock prevents overlapping runs, and a run where every request fails surfaces an error rather than a false `fetched: 0` success.

### Production deployment (Lambda)

Ingestion runs in a standalone AWS Lambda (`oppy-ingestion`) that reuses the same `lib/ingestion` pipeline validated in tests:

- **Runtime:** Node.js 24 · **Memory:** 512 MB · **Timeout:** 900 s
- **Region:** `ap-south-1`
- **Deploy:** `scripts/deploy-ingestion-lambda.sh` (creates or updates the function idempotently, configures env vars from `.env.local`, and runs an optional single-source JSearch smoke test — set `SKIP_JSEARCH_TEST=1` to skip it when free-tier quota must be preserved).
- **Bundle:** `npm run lambda:build` → `lambda/dist/handler.zip`
- **Scheduling:** EventBridge-ready via `scripts/setup-eventbridge-schedule.sh` (every 6 hours; not yet enabled). Until EventBridge is enabled, ingestion is triggered manually via `POST /api/cron/ingest` (with `CRON_SECRET`) or the admin UI.
- Monthly JSearch quota is protected operationally — conservative scheduling (7-day JSearch-family interval, 30-day site-scoped interval) combined with the 16-request per-run cap — not by a persistent monthly counter.

## Recommendation & Search

- **Filters/query** (`/`): category, location (with Bengaluru↔Bangalore normalization), remote, experience, interests, and free-text search. Exact matches rank first; "related" fallback only appears when there are zero exact matches. A Remote opportunity is never labeled with an active city filter — card locations always reflect the opportunity's actual location.
- **Recommended ranking:** runs over a bounded, category-balanced candidate pool (the dashboard no longer transfers all active documents — per-category quota queries keep it ~1s while preserving every category).
- **Similar opportunities:** derived per opportunity by category/tag/location similarity.

## Project Structure

```
app/                      Next.js App Router pages + API routes
  api/auth/*              login, signup, logout, me, Google OAuth, forgot/reset password
  api/opportunities*      browse, detail, similar
  api/saved, tracking, recently-viewed, profile, resume
  api/ai/*                natural-language / voice interpretation
  api/cron/*              ingest, lifecycle, reminders (CRON_SECRET)
  api/admin/*             admin UI + run-ingestion
  opportunity/[id]/       detail page with dynamic OG/Twitter metadata
components/               cards, nav, modals (logout confirmation), share UI, etc.
lib/                      auth, mongodb, email, relevance, discovery, ingestion
lib/ingestion/            pipeline + per-source adapters + scheduler + quality filters
lambda/                   standalone ingestion Lambda bundle config
scripts/                  deploy scripts, backfill/audit/data tools
public/                   static assets incl. og-homepage.png
```

## Environment Variables

Place in `.env.local` (never commit real values). Names are the ones actually referenced by the code.

### Core (required for the app to run)

```bash
MONGODB_URI=                       # MongoDB connection string
MONGODB_DB=oppy                    # optional; defaults to "oppy"
SESSION_SECRET=                    # session/cookie signing (falls back to ADMIN_SECRET)
ADMIN_SECRET=                      # admin API bearer/session auth
CRON_SECRET=                       # protects /api/cron/* endpoints
NEXT_PUBLIC_APP_URL=               # public site URL (metadata, canonical, share links)
```

### Auth

```bash
GOOGLE_CLIENT_ID=                  # optional — enables Google OAuth
GOOGLE_CLIENT_SECRET=              # optional — enables Google OAuth
APP_URL=                           # optional — OAuth redirect origin override
```

### Email (optional — password reset / reminders)

```bash
EMAILJS_SERVICE_ID=
EMAILJS_TEMPLATE_ID=
EMAILJS_PUBLIC_KEY=
EMAILJS_PRIVATE_KEY=
EMAILJS_REMINDER_TEMPLATE_ID=      # optional; falls back to EMAILJS_TEMPLATE_ID
```

### Ingestion & sources

```bash
JSEARCH_API_KEY=                   # JSearch via OpenWeb Ninja (preferred)
RAPIDAPI_KEY=                      # legacy fallback for the JSearch adapter
JSEARCH_MAX_REQUESTS_PER_RUN=16    # optional per-run request cap
BRAVE_API_KEY=                     # optional — web search for discovery
LUMA_CALENDARS=                    # optional — comma-separated Luma calendar slugs
NEXT_PUBLIC_CRON_CONFIGURED=true   # optional — surfaces cron status in admin UI
```

### Optional AI / voice

```bash
SARVAM_API_KEY=                    # natural-language query + voice interpretation
SARVAM_MOCK=true                   # optional — run AI endpoints without the provider
OPENAI_API_KEY=                    # optional supplementary AI features
```

> The ingestion Lambda only receives `MONGODB_URI`, `MONGODB_DB`, `JSEARCH_API_KEY`, `RAPIDAPI_KEY`, `LUMA_CALENDARS`, `BRAVE_API_KEY`, and `NODE_ENV`.

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure .env.local (see above — MONGODB_URI + SESSION_SECRET + ADMIN_SECRET minimum)

# 3. Start the dev server
npm run dev          # http://localhost:3000

# 4. Run ingestion once (optional)
curl -X POST http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer $CRON_SECRET"
```

Other scripts: `npm run seed`, `npm run lambda:build`, `npm test`, `npm run lint`, `npm run build`.

> Note: don't run `npm run build` while `next dev` is live — both share `.next` and the build can corrupt the running dev server. Stop dev, build, then restart.

## Testing

```bash
npm test            # full Vitest suite (1400+ tests)
npx tsc --noEmit    # TypeScript check
npm run build       # production build (stop the dev server first)
```

Tests cover auth flows, password-reset security (no account enumeration, expiry, resend rules), logout confirmation UX, password visibility toggles, share/LinkedIn URL correctness, OG metadata, opportunity card equality + stipend formatting, filter/relevance behavior, and ingestion (Internshala extraction, HN quality rules, JSearch plan/budget/seniority/concurrency, scheduler, deploy-script structure).

## Security Notes

- Passwords are bcrypt-hashed server-side; never stored in plaintext.
- Session cookies are httpOnly + sameSite=lax; sessions are stored server-side.
- Forgot-password never reveals whether an email is registered (same generic response for both cases); reset codes expire and are one-time use; client countdown never overrides server-side expiry validation.
- API keys, MongoDB credentials, OAuth secrets, and admin/cron secrets are server-side only and never committed (`.env.local` is gitignored).
- Admin API and cron endpoints require `ADMIN_SECRET` / `CRON_SECRET` bearer tokens.

## Design

OPPY uses a warm, editorial design system: cream/ivory backgrounds, lavender/sage/peach accents, Space Grotesk headlines, JetBrains Mono metadata, subtle card interactions, mobile-first responsive layout.

## License

Private — All rights reserved.
