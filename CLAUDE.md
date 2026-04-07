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

Affiliate tags stored in the `affiliateconfigs` MongoDB collection (editable via admin UI) take precedence over env vars.

## Telegram setup

To generate a `TELEGRAM_SESSION` string, run gramjs's `StringSession` auth flow once interactively, then paste the resulting string into the env var. The API ID and hash come from [my.telegram.org](https://my.telegram.org).
