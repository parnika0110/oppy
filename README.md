# OPPY — Opportunity Discovery Platform

> Good opportunities shouldn't be this hard to find.

OPPY discovers real opportunities from across the web — internships, jobs, hackathons, fellowships, events, grants, and scholarships — and matches them to what you're looking for.

## Tech Stack

- **Framework:** Next.js 15 (App Router, React 19)
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **AI:** Sarvam AI (natural language queries, voice search, translation)
- **Styling:** Tailwind CSS + custom editorial design system
- **Deployment:** AWS Amplify / Vercel
- **Testing:** Vitest

## Architecture

```
Landing Page → Discovery Wizard → Personalized Results
     ↓                                    ↓
User Auth (Supabase)              Browse + Filters
     ↓                                    ↓
Dashboard                    Opportunity Detail → Save / Track
     ↓
Saved + Applications
```

### Data Flow

```
External Sources → Fetchers → Parsers → Normalizers → Validators → Dedup → Supabase → Browse API → UI
```

## Discovery Sources (16)

| Source | Auth Required | What It Finds |
|---|---|---|
| JSearch | RAPIDAPI_KEY | LinkedIn, Indeed, Glassdoor, Naukri (aggregated) |
| LinkedIn | RAPIDAPI_KEY | Dedicated LinkedIn queries |
| Indeed | RAPIDAPI_KEY | Dedicated Indeed queries |
| Glassdoor | RAPIDAPI_KEY | Dedicated Glassdoor queries |
| Naukri | None | Direct HTML scraping |
| Internshala | None | 8 category pages |
| RemoteOK | None | Remote tech jobs |
| YC Work at Startup | None | YC startup jobs |
| Hacker News | None | "Who is hiring?" threads |
| Wellfound | RAPIDAPI_KEY | Startup jobs via JSearch |
| Devpost | None | Hackathons |
| Devfolio + MLH | None | Hackathons |
| Luma | LUMA_CALENDARS | Events from configured calendars |
| Eventbrite | None | Events |
| Unstop | None | Indian competitions |
| RSS Feeds | None | 15+ feeds from job boards, communities |
| GitHub | None | Open source programs |

## Database Schema

See `supabase/migrations/001_initial_schema.sql` for the complete schema.

Key tables:
- `profiles` — user profiles (extends Supabase Auth)
- `user_preferences` — discovery preferences per user
- `opportunities` — all published opportunities
- `saved_opportunities` — user saves (unique per user+opportunity)
- `application_tracking` — track application status
- `recently_viewed` — view history
- `ingestion_runs` — pipeline execution logs
- `source_health` — per-source health status
- `discovery_candidates` — moderation queue

## Environment Variables

Required:

```bash
NEXT_PUBLIC_SUPABASE_URL=           # Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=          # Supabase service role (server only)
ADMIN_SECRET=                       # Admin API access
CRON_SECRET=                        # Scheduled ingestion
```

Optional:

```bash
SARVAM_API_KEY=                     # Enables AI query interpretation + voice
RAPIDAPI_KEY=                       # Enables LinkedIn/Indeed/Glassdoor/Naukri
LUMA_CALENDARS=                     # Comma-separated Luma calendar slugs
```

See `.env.example` for full documentation.

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up Supabase
#    - Create a project at https://supabase.com
#    - Run the migration in SQL Editor: supabase/migrations/001_initial_schema.sql
#    - Copy API keys to .env.local

# 3. (Optional) Migrate existing MongoDB data
npm run migrate

# 4. Start dev server
npm run dev
```

## Testing

```bash
npm test          # Run all Vitest tests
npm run lint      # ESLint
npm run build     # Production build
```

## Ingestion

Trigger manually from Admin → Ingestion, or via API:

```bash
curl -X POST http://localhost:3000/api/admin/run-ingestion \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

For scheduled ingestion, set up a cron job calling `/api/cron/ingest` with `CRON_SECRET`.

## Security

- **RLS enabled** on all user-owned tables
- **Service role key** never exposed to browser
- **Admin auth** via signed session tokens (HMAC-SHA256)
- **User auth** via Supabase Auth (httpOnly cookies)
- **Passwords** hashed by Supabase Auth (never stored in plaintext)
- **API keys** server-side only

## Design

OPPY uses a warm, editorial design system:

- Cream/ivory backgrounds
- Lavender/sage/peach accent colors
- Space Grotesk headlines
- JetBrains Mono metadata
- Subtle card interactions
- Mobile-first responsive

Inspired by [parnika-sm.vercel.app](https://parnika-sm.vercel.app/).

## License

Private — All rights reserved.
