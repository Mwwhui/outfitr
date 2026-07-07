# Outfitr

<p align="center">
  <img src="public/logo.png" alt="Outfitr" width="120" height="120" />
</p>

<p align="center">
  <strong>Smarter Wardrobe, Smarter Choices.</strong>
</p>

Smart wardrobe app — manage clothing, plan outfits, take sustainable action, and try on virtually.

## Tech Stack

- **Next.js 15.5** (App Router, TypeScript, Turbopack)
- **Tailwind CSS 4** (`@theme` in `globals.css`, no `tailwind.config.js`)
- **Supabase** (Postgres + Storage)
- **NextAuth v4** (credentials + Google OAuth)
- **Gemini 2.5 Flash Lite** (AI features)
- **Replicate** (AI virtual try-on)
- **TanStack Query** (client-side data fetching)
- **React Hot Toast** (notifications)
- **React Email + Resend** (transactional emails)
- **Leaflet + react-leaflet** (pre-loved map)
- **FullCalendar** (calendar view)
- **Framer Motion** (animations)
- **WXT** (browser extension framework)

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project
- Gemini API key
- Replicate API token
- Resend API key (for emails)
- Google OAuth credentials (for Google Calendar + social login)

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
GEMINI_API_KEY=
NEXT_PUBLIC_YOLO_API_URL=https://clothing-detection-production.up.railway.app
REPLICATE_API_TOKEN=
RESEND_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Supabase Setup

Create the following buckets in Supabase Storage:

- `user-photos` — user profile/try-on photos
- `tryon-results` — cached try-on output images
- `user-wishlist` — wishlist item images (future)

Run this SQL in the Supabase SQL editor:

```sql
-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- Try-on rate limiting
ALTER TABLE users ADD COLUMN try_on_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN try_on_reset_at DATE DEFAULT CURRENT_DATE;
```

### Development

```bash
npm install
npm run dev        # Start Next.js dev server on :3000
npm run build      # Production build
npm run lint       # ESLint
```

### Browser Extension

```bash
cd browser-extension
npm install
npm run dev:build  # Development build (API: localhost:3000)
npm run build      # Production build (API: outfitr.app)
```

Load the built extension from `browser-extension/.output/chrome-mv3/` via `chrome://extensions` (Developer mode).

## Features

### Wardrobe Management

- Add clothing items with auto-detection (YOLO + MobileNet)
- Item detail/edit with color, material, season, use case
- Filter by category, color, season, favorites
- K-means wardrobe clustering

### AI Virtual Try-On

- Multi-garment try-on using Replicate (`prunaai/p-image-try-on`)
- Upload a user photo, select garments from wardrobe, preview the result
- Download try-on results as PNG
- Monthly rate limit (12 per user, resets calendar month)
- Cached results (1hr in-memory + Supabase persistence)

### AI Features (Gemini)

- **Scan-to-Buy** — evaluate purchase decisions against your existing wardrobe
- **Outfit Suggestions** — AI-reasoned daily outfit recommendations
- **Style DNA** — style analysis from wardrobe patterns
- **Seasonal Tips** — personalized seasonal readiness
- **Shopping Recommendations** — AI-enriched shopping list
- **Sustainability Story** — AI-generated impact narrative
- **Color Detection** — extract color from garment images
- **Visual Similarity** — detect duplicates when adding items
- **Browser Extension** — scan products from any website

### Outfit Planning

- Drag-and-drop outfit builder (planner) with 4-slot system (top, bottom, onepiece, outerwear)
- Weather-aware suggestions
- AI virtual try-on from the planner
- Calendar view with Google Calendar integration
- Outfit combination scoring engine

### Home Dashboard

- **Today's Ensemble** — AI outfit suggestion with weather/tags
- **Weather Alert** — rain, temp drop, extreme heat alerts
- **Today's Events** — Google Calendar events with occasion detection
- **Action Required** — pending pledge status
- **Monthly Story** — most-worn item spotlight
- **Smart Shopping List** — AI-enriched recommendations
- **Seasonal Readiness** — season coverage bar + missing items
- **Circularity Score** — wardrobe health score (0-100)
- **Sustainability Story** — AI-generated impact narrative
- **Wardrobe Analytics** — color palette, category balance, rotation stats
- **Outfit Feedback** — post-wear feedback overlay
- **Notification Bell** — alert center with weather, pledges, overconsumption, wear streak notifications
- **Browser notifications** for critical alerts

### Sustainability Hub (Pre-Loved)

- Donate / Sell / Recycle / DIY actions
- Partner directory with Leaflet map
- Upcycling tutorials (accordion)
- Pledge management with QR fulfillment flow
- Partner-facing scan + fulfill flow

### Dashboard & Analytics

- Wardrobe value (cost-per-wear)
- Sustainability impact (CO₂, water, trees)
- Category breakdown, top brands
- Items added over time
- Most/least worn items
- Pledge activity timeline

### Profile & Account

- Edit profile (username, name, DOB, gender, nationality, contact)
- **Change password** — for email-registered users (requires current password)
- **Set password** — for Google-registered users (set one for email login)
- **Forgot password** — email-based reset via Resend
- **Password reset** — token-based with 1hr expiry, one-time use

### Browser Extension (`browser-extension/`)

| Page      | Purpose                                                                       |
| --------- | ----------------------------------------------------------------------------- |
| Popup     | Auth, connection status, compact scan results                                 |
| Sidepanel | Full scan breakdown with score ring, bars, ghost items, pairings, CPW, budget |
| Options   | Auto-connect toggle, disconnect, quick links                                  |

**Auto-connect flow:** Popup → open connect page → content script reads HMAC token from DOM → background saves → polling detects connection.

**Scan flow:** Right-click product image → background fetches + converts → YOLO-first detection → Gemini enrichment + verdict → result stored in session storage → sidepanel renders.

### Auth Flows

- Web app: NextAuth credentials + Google OAuth
- Extension: Stateless HMAC-signed tokens using `NEXTAUTH_SECRET`
  - Format: `base64url(user_id\|expiresAt\|nonce).HMAC-SHA256`
  - No DB table needed — verified with `crypto.timingSafeEqual`

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes
│   │   ├── auth/           # NextAuth + forgot/reset password
│   │   ├── clothes/        # CRUD, detect-color, detect-use-case, similar
│   │   ├── outfits/        # Suggest, DNA, frequent combos
│   │   ├── wardrobe/       # Monthly insights, clusters, sustainability story
│   │   ├── user/           # Profile, photo upload
│   │   ├── planner/        # Outfit plans CRUD
│   │   ├── pledges/        # Pre-loved pledges
│   │   ├── partners/       # Partner directory + pledge management
│   │   ├── integrations/   # Google Calendar OAuth + events
│   │   ├── dashboard/      # Analytics stats
│   │   ├── tryon/          # AI virtual try-on
│   │   └── home/           # Alert data
│   ├── auth/               # Login, register, forgot/reset password
│   ├── home/               # Dashboard landing page
│   ├── wardrobe/           # Grid, detail, upload, scan, scan history
│   ├── planner/            # Outfit builder + try-on panel
│   ├── calendar/           # Calendar + Google integration
│   ├── outfits/            # Style Lab
│   ├── dashboard/          # Analytics
│   ├── pre-loved/          # Sustainability hub
│   ├── profile/            # Profile edit
│   ├── partner/            # Partner dashboard + QR scanner
│   ├── extension/          # Extension connect page
│   └── components/         # Shared React components
│       ├── home/           # Dashboard widgets (TodaysEnsemble, WeatherAlert, etc.)
│       ├── dashboard/      # Analytics cards
│       ├── pre-loved/      # Partner directory, map, tutorials
│       └── partner/        # Pledge card
├── emails/                 # React Email templates (password reset, pledge notifications)
├── lib/                    # Utilities (gemini, supabase, kmeans, color, resend, etc.)
├── hooks/                  # Custom hooks + TanStack Query mutations
└── types/                  # TypeScript augmentations

browser-extension/
└── src/
    ├── entrypoints/
    │   ├── background.ts    # Service worker, context menu, scan logic, progress tracking
    │   ├── popup/           # Auth UI, compact scan results, progress polling
    │   ├── sidepanel/       # Full scan breakdown, step progress, stuck/timeout handling
    │   ├── options/         # Settings page
    │   └── content-auth.ts  # Reads HMAC token from connect page DOM
    ├── lib/                 # API client, auth, types
    └── public/icons/        # Extension icons
```

## Scan Pipeline

Located in `src/lib/scanPipeline.ts`:

1. **YOLO-first detection** — calls `/auto-detect` (10s timeout), falls back to Gemini vision on low confidence
2. **Gemini enrichment** — fills in material, formality, season, pattern, style keywords
3. **Similarity risk** — compares color + type against existing wardrobe
4. **Gap fill** — assesses category deficit
5. **Outfit multiplier** — counts new outfit combinations with existing items
6. **Ghost items** — finds same-type + similar-color items with low wear count
7. **Budget context** — compares price against wardrobe average/median/max
8. **Gemini verdict** — text-only LLM generates score (0-100), verdict, one-liner, reasoning
9. **Rate limit handling** — flags `rate_limited: true` if Gemini returns 429, uses statistical fallback

Note: Gemini calls use `maxRetriesPerModel=0` for scan routes; the `callGeminiWithFallback` utility in `src/lib/gemini.ts` supports model fallback (flash-lite → flash) with 15s timeout.

## Try-On Pipeline

Located in `src/app/api/tryon/route.ts`:

1. User uploads a full-body photo (stored in `user-photos` bucket)
2. User selects 1-4 garments from their wardrobe
3. API sends all garments + user photo to Replicate `prunaai/p-image-try-on` in a single call
4. Result cached in-memory (1hr TTL) and in Supabase `tryon_cache` table
5. GET returns cached result on subsequent requests
6. Rate limit: 12 try-ons per calendar month, tracked via `users.try_on_count` column
