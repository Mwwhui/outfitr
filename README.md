# Outfitr

Smart wardrobe app — manage clothing, plan outfits, and take sustainable action on unused items.

## Tech Stack

- **Next.js 15.5** (App Router, TypeScript, Turbopack)
- **Tailwind CSS 4** (`@theme` in `globals.css`, no `tailwind.config.js`)
- **Supabase** (Postgres + Storage)
- **NextAuth v4** (credentials + Google OAuth)
- **Gemini 2.5 Flash Lite** (AI features)
- **TanStack Query** (client-side data fetching)
- **Leaflet + react-leaflet** (pre-loved map)
- **FullCalendar** (calendar view)
- **WXT** (browser extension framework)

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project
- Gemini API key

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
- Drag-and-drop outfit builder (planner)
- Calendar view with Google Calendar integration
- Outfit combination scoring engine

### Sustainability Hub (Pre-Loved)
- Donate / Sell / Recycle / DIY actions
- Partner directory with Leaflet map
- Upcycling tutorials
- Pledge management with QR fulfillment flow

### Dashboard
- Wardrobe value (cost-per-wear)
- Sustainability impact (CO₂, water, trees)
- Category breakdown, top brands
- Items added over time
- Most/least worn items

### Browser Extension (`browser-extension/`)

| Page | Purpose |
|------|---------|
| Popup | Auth, connection status, compact scan results |
| Sidepanel | Full scan breakdown with score ring, bars, ghost items, pairings, CPW, budget |
| Options | Auto-connect toggle, disconnect, quick links |

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
│   ├── api/                # API routes (auth, clothes, outfits, etc.)
│   ├── auth/               # Login / register
│   ├── home/               # Dashboard
│   ├── wardrobe/           # Grid, detail, upload, scan-to-buy, scan history
│   ├── planner/            # Outfit builder
│   ├── calendar/           # Calendar + Google integration
│   ├── outfits/            # Style Lab
│   ├── dashboard/          # Analytics
│   ├── pre-loved/          # Sustainability hub
│   ├── extension/          # Extension connect page
│   └── components/         # Shared React components
├── lib/                    # Utilities (gemini, supabase, kmeans, color, etc.)
├── hooks/                  # TanStack Query mutations
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
