# Schema.org / Structured Data Audit — dealdost.shop

Audited: 2026-08-02 (live crawl via Playwright-rendered fetch, `structured_data` extraction) + source review of `apps/web/src`.
Routes checked live: `/`, `/trending`, `/category/electronics`, `/price-drops` (raw and rendered both fetched for `/`).

## Detection Results

**Zero JSON-LD, Microdata, or RDFa blocks found on any route checked**, rendered or raw:

| Route | `structured_data.block_count` |
|---|---|
| `/` (rendered, Playwright) | 0 |
| `/` (raw HTML) | 0 |
| `/trending` | 0 |
| `/category/electronics` | 0 |
| `/price-drops` | 0 |

No `Organization`, `WebSite`, `BreadcrumbList`, `Product`, `ItemList`, or any other schema is currently reaching users or crawlers on the live site.

### Critical: schema exists in source but is not live — deployment issue, not a code gap

`apps/web/src/components/Seo.tsx` is a working `react-helmet-async` wrapper that already accepts a `jsonLd` prop and renders `<script type="application/ld+json">` tags, and `HelmetProvider` is correctly wired in `apps/web/src/main.tsx:15`. `apps/web/src/pages/Home.tsx:18-37` already passes a fully-formed `Organization` + `WebSite` (with `SearchAction`) JSON-LD array to `<Seo jsonLd={...} />` on the `/` route.

Despite this, the live rendered fetch of `/` (Playwright, full JS execution, ~18s render) returns `block_count: 0`. This is consistent with the site-wide finding (flagged separately by the technical audit) that production is serving a raw Vite dev server rather than a production build — the `/@react-refresh` and `/@vite/client` dev-mode script tags are present in the served HTML. **This is a deployment/build issue, not a schema-authoring issue**: the Organization/WebSite JSON-LD code is correct and will very likely appear automatically once the site is built (`pnpm --filter @deals/web build`) and served from `dist/` instead of the dev server.

**Action for the team**: coordinate with the technical audit finding on dev-mode-in-production. Once fixed, re-crawl `/` to confirm Organization/WebSite JSON-LD appears — this recommendation may already be "done" pending deployment.

`Category.tsx`, `Trending.tsx`, `PriceDrops.tsx`, `Search.tsx` (noindex), `DigestDeals.tsx`, `Assistant.tsx`, `Login.tsx`, `Signup.tsx` all use `<Seo>` for title/meta/OG/Twitter tags but **none pass a `jsonLd` prop** — no schema authored for these routes yet, independent of the deployment issue.

## Validation Results

Nothing to validate live (no blocks present). Reviewing the source-authored Organization/WebSite block in `Home.tsx` against schema requirements:

| Check | Organization | WebSite |
|---|---|---|
| `@context` = `https://schema.org` | ✅ | ✅ |
| `@type` valid, not deprecated | ✅ | ✅ |
| Required properties present | ✅ `name`, `url` | ✅ `name`, `url` |
| Absolute URLs | ✅ (`https://dealdost.shop/...`) | ✅ |
| No placeholder text | ✅ | ✅ |
| `SearchAction` shape | — | ✅ correct `potentialAction` / `query-input` pattern |

One gap: `Organization.logo` (`${SITE_URL}/icon-512.png`) should be confirmed to be a real, non-transparent, reasonably-proportioned image per Google's logo guidelines (min 112x112px) — worth a quick check once the build issue is fixed and the block is actually live and testable in Google's Rich Results Test.

## Missing Opportunities

### 1. Organization + WebSite (sitewide) — Critical, likely blocked on deployment only
Already coded (see above). No action needed beyond fixing the production build/serve issue and re-verifying.

### 2. BreadcrumbList on category pages — High priority, easy win
`Category.tsx` renders `/category/:name` with no breadcrumb schema. Trivial to add (Home → Category), improves SERP snippet display and reinforces site hierarchy for a site with flat URL structure and no product permalinks.

### 3. ItemList on listing pages (`/`, `/trending`, `/category/:name`, `/price-drops`) — Medium priority, informational only
The team-lead brief correctly notes there are no per-deal permalink pages, so individual `Product`/`Offer` schema has no URL to attach to yet. `ItemList` markup describing the deals shown on a listing page is still valid and useful for entity/context signals, **but will not qualify for Product/merchant carousel rich results** — those require `item.url` pointing to a page dedicated to that product, `Offer.priceValidUntil`, `Offer.availability`, etc. Ship this as descriptive structured data now; treat rich-result eligibility as a later milestone (see §4).

Recommendation: nest `Product`/`Offer` inside each `ListItem` (without a per-product `url`, since none exists) rather than a bare list of names — this gives Google richer entity data (price, image, source/brand) even without a dedicated URL, while being transparent that it's not carousel-eligible.

### 4. Roadmap: Product/Offer schema once per-deal permalink pages exist
Flagging as a dependency, not blocking current recommendations. If/when a `/deal/:id` or `/product/:slug` route is added:
- Each such page should carry a standalone `Product` schema with nested `Offer` (`price`, `priceCurrency: "INR"`, `availability`, `url` = affiliate click endpoint or a canonical page — **not** the raw affiliate URL, consistent with the existing pattern in `apps/api/src/routes` of never exposing raw affiliate tags), and `AggregateRating`/`Review` where `deal.rating` exists.
- At that point, the `ItemList` on category/trending pages should be updated so each `ListItem.url` points to the new permalink — this is what unlocks merchant listing / product carousel eligibility that isn't achievable today.
- `image_url`, `product_title`, `price`, `original_price`, `rating`, `source` (Amazon/Flipkart/Myntra as `Brand`/`seller`) are already present on the `Deal`/`Product` type (`packages/types/src/index.ts`) and map cleanly to `Product`/`Offer` fields, so this is a low-effort follow-up once permalinks exist.

### FAQPage note
No FAQ content detected on any route (`/digest`, `/assistant` etc. are functional, not Q&A). No FAQPage recommendation — and per current guidance, FAQPage has no Google SERP rich-result benefit as of May 2026 even if content existed, so this is moot either way.

## Ready-to-use JSON-LD

### Organization + WebSite (already coded — reference only, confirm post-deploy)
```json
[
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "DealDost",
    "url": "https://dealdost.shop",
    "logo": "https://dealdost.shop/icon-512.png"
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "DealDost",
    "url": "https://dealdost.shop",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://dealdost.shop/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
]
```

### BreadcrumbList — add to `Category.tsx`
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://dealdost.shop/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Electronics Deals",
      "item": "https://dealdost.shop/category/electronics"
    }
  ]
}
```
Implementation note: pass this via the existing `jsonLd` prop on `<Seo>` in `Category.tsx:15-19`, e.g. `jsonLd={buildBreadcrumb(name)}`, capitalizing `name` for the `name` field.

### ItemList (informational, no carousel eligibility) — add to `Trending.tsx` / `PriceDrops.tsx` / `Category.tsx` / `Home.tsx`
```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "Product",
        "name": "Vega Voyager Full Face Riding Helmet",
        "image": "https://m.media-amazon.com/images/example.jpg",
        "brand": { "@type": "Brand", "name": "Amazon" },
        "offers": {
          "@type": "Offer",
          "price": "1899",
          "priceCurrency": "INR",
          "availability": "https://schema.org/InStock"
        }
      }
    }
  ]
}
```
Populate `itemListElement` from the same `deal`/`Product` array already rendered by `InfiniteDealGrid`/`DealCard` (map `deal.product_title` → `name`, `deal.image_url` → `image`, `deal.source` → `brand.name`, `deal.price`/`deal.original_price` → `offers`). Omit `item.url` until permalink pages exist (see roadmap above) rather than pointing it at the affiliate redirect, which would misrepresent the item's canonical location.

## Summary of Priorities
1. **Critical** — Fix production deployment (raw Vite dev server → production build). Organization/WebSite schema is already coded and should land for free.
2. **High** — Add `BreadcrumbList` to `Category.tsx` (new code, small effort).
3. **Medium** — Add informational `ItemList`/`Product`/`Offer` (no URL) to `Home.tsx`, `Trending.tsx`, `PriceDrops.tsx`, `Category.tsx`.
4. **Future/dependency** — Full `Product`/`Offer` schema with rich-result eligibility once per-deal permalink pages exist.
