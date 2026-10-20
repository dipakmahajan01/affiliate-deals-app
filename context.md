# Current Session Context

## Repository And Branch

- Repo: `D:\dipak-task\affiliate-deals-app`
- Active branch: `feature/product-details`
- Production branch was not touched.
- Existing committed feature commit: `cb82bc0 Add product details page`

## Product Details Feature Implemented

- Added product detail route in `apps/web/src/App.tsx`:
  - `/product/:slug`
- Added detail page:
  - `apps/web/src/pages/ProductDetails.tsx`
- Added slug helper:
  - `apps/web/src/utils/productSlug.ts`
- Updated product cards:
  - `apps/web/src/components/DealCard.tsx`
  - Product image and title navigate to `/product/<title-slug>-<id>`.
  - `Get This Deal` still uses the existing tracked redirect flow.
- Updated SEO canonical base:
  - `apps/web/src/components/Seo.tsx`
  - `https://www.dealdost.shop`
- Updated crawl files:
  - `apps/web/public/robots.txt`
  - `apps/web/public/sitemap.xml`

## First Commit

Committed product details feature:

```text
cb82bc0 Add product details page
```

That commit includes:

- `apps/web/public/robots.txt`
- `apps/web/public/sitemap.xml`
- `apps/web/src/App.tsx`
- `apps/web/src/components/DealCard.tsx`
- `apps/web/src/components/Seo.tsx`
- `apps/web/src/pages/ProductDetails.tsx`
- `apps/web/src/utils/productSlug.ts`

## Amazon Full Product Details / Crawlee Work

User asked to fetch full product details from Amazon using Crawlee.

Current code path:

- Main scraper:
  - `apps/api/src/services/scraper.ts`
- New products saved by poller:
  - `apps/api/src/services/poller.ts`
- Existing products refreshed:
  - `apps/api/src/services/refresh.ts`
- Mongo Product model:
  - `apps/api/src/models/Product.ts`
- Shared type:
  - `packages/types/src/index.ts`
- Frontend display:
  - `apps/web/src/pages/ProductDetails.tsx`

Added dependency:

- `crawlee` in `apps/api/package.json`
- `pnpm-lock.yaml` changed

New scraped/stored Amazon fields:

- `review_count`
- `brand`
- `availability`
- `asin`
- `product_details`
- `breadcrumbs`
- `images`

Already existing fields still used:

- `title`
- `price`
- `original_price`
- `image_url`
- `description`
- `rating`
- `features`
- `bank_offers`

## Database Finding

The API initially failed because:

- `apps/api/.env` has `MONGODB_URI` pointing to local MongoDB:
  - host: `localhost`
  - port: `27017`
- No local MongoDB was running.

Root `.env` has cloud MongoDB:

- scheme: `mongodb+srv`
- host: `cluster0.nwvgz8f.mongodb.net`
- database path: `/dealsdost`

For local testing, API was started with root `.env` `MONGODB_URI` and `PORT=3000`.

## Running Local Servers

During session, servers were started in background:

- API:
  - `http://localhost:3000`
  - health: `http://localhost:3000/health`
- Frontend:
  - `http://localhost:5173`

Frontend was started with:

```powershell
$env:VITE_API_BASE_URL='/v1'
pnpm exec vite --port 5173 --host 0.0.0.0
```

API was restarted using root cloud DB URI and forced port:

```powershell
$env:MONGODB_URI = <root .env MONGODB_URI>
$env:PORT = '3000'
pnpm run dev
```

Telegram poller warning occurred:

```text
AUTH_KEY_DUPLICATED
```

This did not block API/product data testing.

## Tested Product

Selected test product:

```text
id: 6ac9c0dc7e639d70730f726c
source: Amazon
type: product
title: Fort Collins Women Thermal Leggings – Ultra-Warm, Stretchable Winter Wear with Soft Fleece Lining
```

Test product page:

```text
http://localhost:5173/product/fort-collins-women-thermal-leggings-ultra-warm-stretchable-winter-wear-with-soft-6ac9c0dc7e639d70730f726c
```

API detail:

```text
http://localhost:3000/v1/products/6ac9c0dc7e639d70730f726c
```

One-product Crawlee refresh was run and updated MongoDB for this item.

Verified fields after refresh:

- brand: `Fort Collins`
- asin: `B0DJMLBVL9`
- price: `599`
- rating: `3.6`
- review_count: `34`
- product_details count: `40`
- images count: `8`
- availability: present

## Verification Already Run

Passed:

```powershell
pnpm --filter @deals/web exec tsc --noEmit
pnpm --filter @deals/web exec vite build
pnpm --filter @deals/api exec tsc --noEmit
```

Lint issue:

```text
pnpm --filter @deals/web run lint
```

Failed because `eslint` is not installed/available:

```text
'eslint' is not recognized as an internal or external command
```

## Current Pending Files

After Crawlee work, pending source changes include:

- `apps/api/package.json`
- `apps/api/src/models/Product.ts`
- `apps/api/src/services/poller.ts`
- `apps/api/src/services/refresh.ts`
- `apps/api/src/services/scraper.ts`
- `apps/web/src/pages/ProductDetails.tsx`
- `packages/types/src/index.ts`
- `pnpm-lock.yaml`
- `context.md`

Untracked generated/runtime files that should generally not be committed:

- `apps/api/storage/`
- `apps/web/.next/`
- `apps/web/next-env.d.ts`

## Recommended Next Steps

1. Review the product page in Chrome:

   ```text
   http://localhost:5173/product/fort-collins-women-thermal-leggings-ultra-warm-stretchable-winter-wear-with-soft-6ac9c0dc7e639d70730f726c
   ```

2. Confirm Amazon full product details render correctly:

   - brand
   - ASIN
   - rating/review count
   - availability
   - image gallery
   - product details table

3. Decide whether to commit the Crawlee/full-details work.

4. If committing, stage source changes and lockfile only. Do not stage:

   - `apps/api/storage/`
   - `apps/web/.next/`
   - `apps/web/next-env.d.ts`

5. Consider adding `apps/api/storage/`, `apps/web/.next/`, and `apps/web/next-env.d.ts` to `.gitignore` if they should never appear in status.

