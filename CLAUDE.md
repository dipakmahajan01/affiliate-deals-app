# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all dependencies (run from root)
pnpm install

# Start all apps in parallel (API :4000, web :3000, admin :3001)
pnpm dev

# Build all apps
pnpm build

# Run a single app
pnpm --filter @deals/api dev
pnpm --filter @deals/web dev
pnpm --filter @deals/admin dev
```

Before running, copy `.env.example` to `apps/api/.env` and fill in the required values.

## Architecture

Turborepo monorepo with three apps and one shared package:

```
apps/api      — Express REST API (Node.js + TypeScript + Mongoose)
apps/web      — User-facing deals feed (React + Vite + Tailwind, PWA)
apps/admin    — Internal admin dashboard (React + Vite + Tailwind, JWT-protected)
packages/types — Shared TypeScript interfaces (Deal, Channel, Click, AffiliateConfig)
```

Both `apps/web` and `apps/admin` proxy `/v1` requests to `http://localhost:4000` via Vite's dev server proxy.

## Key flows

**Telegram → MongoDB**: `apps/api/src/services/poller.ts` runs a `node-cron` job every 10 min. It calls `getTelegramClient()` (gramjs MTProto), fetches messages per active channel, runs them through `parser.ts`, resolves short URLs, builds the affiliate URL, and upserts to the `deals` collection with a `{channel_id, message_id}` unique index to prevent duplicates.

**Affiliate link generation**: `apps/api/src/services/affiliate.ts`. Short URLs are resolved at poll time (not at click time). The stored `affiliate_url` field in MongoDB already has the tag appended. `POST /v1/deals/:id/click` simply returns this stored URL — it never exposes raw affiliate tags to the client.

**Email digest**: `apps/api/src/services/digest.ts` runs two `node-cron` jobs (9 PM and 10 AM) that email every registered `User` the top 5 active products by `price_drop_percent`, reusing the `/v1/feed/price-drops` query shape. `apps/api/src/services/mailer.ts` wraps Nodemailer over Gmail SMTP and also sends a welcome email fired (non-blocking) from `POST /v1/auth/register`.

**Admin auth**: Single-admin JWT flow. Credentials are set via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars. The JWT is stored in Zustand memory (not localStorage) and attached to every admin API call via an Axios request interceptor in `apps/admin/src/api/client.ts`.

## Environment variables (apps/api/.env)

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` | gramjs MTProto credentials |
| `TELEGRAM_SESSION` | Serialized gramjs StringSession |
| `AMAZON_AFFILIATE_TAG` | Fallback Amazon tag (overridden by DB config) |
| `FLIPKART_AFFILIATE_ID` | Fallback Flipkart affid (overridden by DB config) |
| `JWT_SECRET` | Secret for admin JWT signing |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin login credentials |
| `GEMINI_API_KEY` | Google Gemini (AI Studio) API key for the DealGenie AI shopping assistant |
| `ASSISTANT_MODEL` | Optional model override for the assistant (default `gemini-2.5-flash`) |
| `EMAIL_USER` | Gmail address used as SMTP sender for welcome/digest emails |
| `EMAIL_PASS` | Gmail app password (nodemailer SMTP auth) |
| `EMAIL_FROM` | Optional display "From" header (defaults to `EMAIL_USER`) |

Affiliate tags stored in the `affiliateconfigs` MongoDB collection (editable via admin UI) take precedence over env vars.

## AI shopping assistant (DealGenie)

`apps/api/src/routes/assistant.ts` exposes `POST /v1/assistant/chat`, a Server-Sent Events stream. It runs a Google Gemini (`@google/genai`) streaming function-calling loop: the model calls a `search_products` tool that queries the live `Product` catalog via `apps/api/src/services/productSearch.ts` (the same text-search + `affiliate_url` dedup pipeline as `/v1/products/search`), so every recommendation maps to a real deal. The route streams `text`, `deals`, `done`, and `error` events. The web client (`apps/web/src/api/assistant.ts` + `components/assistant/`) renders streamed text plus a `DealCard` grid, reusing the existing affiliate click flow. The model never sees raw affiliate URLs — cards go through the standard `POST /v1/products/:id/click`.

## Telegram setup

To generate a `TELEGRAM_SESSION` string, run gramjs's `StringSession` auth flow once interactively, then paste the resulting string into the env var. The API ID and hash come from [my.telegram.org](https://my.telegram.org).
