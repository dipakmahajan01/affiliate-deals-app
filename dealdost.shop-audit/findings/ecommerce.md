# E-commerce / Affiliate SEO Audit — dealdost.shop

**Business model:** DealDost is an affiliate deals *aggregator*, not a merchant — it owns no inventory, no checkout, no fulfillment. Every "deal" is a card sourced from Telegram, pointing out to Amazon/Flipkart/Myntra via `POST /v1/deals/:id/click` (`apps/api/src/routes/deals.ts:88`, `apps/api/src/routes/products.ts:142`), which returns a stored `affiliate_url`. This model must be evaluated against deal-aggregator competitors (e.g. sites that rank individual deal pages with expiry/price-history), not against traditional D2C storefronts.

Scores reflect the aggregator model, not generic Product-schema-completeness scoring.

| Category | Score |
|---|---|
| Product/Deal schema | 8/100 |
| URL / permalink structure | 5/100 |
| Category page optimization | 40/100 |
| Price-drop content SEO | 25/100 |
| Marketplace (Merchant Center) fit | N/A (see below) |
| **Overall e-commerce SEO** | **20/100** |

---

## Critical

### 1. No per-deal permalink pages — the single biggest gap vs. competitors
**Evidence:** `apps/web/src/App.tsx:19-29` — the full route table is `/`, `/category/:name`, `/digest`, `/search`, `/trending`, `/price-drops`, `/assistant`, `/login`, `/signup`. There is no `/deal/:id` or `/product/:id` route. Every `DealCard` (`apps/web/src/components/DealCard.tsx`) renders inline in a grid with no `<Link>` or `<a href>` to a dedicated URL — the only interactive element is a `<button onClick={handleBuy}>` that fires a POST request (`apps/web/src/components/DealCard.tsx:177-185`).

This is a structural SEO ceiling, not a content gap: with no unique URL per deal, there is no crawlable, indexable, shareable unit of content to rank a specific product/price query ("iPhone 15 128GB deal", "Redmi Note price drop today"). This is precisely how successful deal-aggregator competitors (e.g. sites that rank in Google for "[product] deal/coupon") build long-tail organic traffic: one URL per deal, carrying its own title, price, expiry, price history and Product/Offer schema, that Google can index and re-crawl as price changes.

Notably, **the backend already has everything needed**: `GET /v1/deals/:id` and `GET /v1/products/:id` exist (`apps/api/src/routes/deals.ts:81`, `apps/api/src/routes/products.ts:135`) and the `Deal`/`Product` types (`packages/types/src/index.ts:4-43`) carry rich per-item data — `price`, `original_price`, `discount_percent`, `previous_price`, `lowest_price`, `price_drop_percent`, `price_dropped_at`, `rating`, `bank_offers`, `coupon_text`, `source`, `posted_at`. This is a frontend/routing gap, not a data gap — the fix is comparatively cheap relative to its expected SEO payoff.

**Recommendation:**
- Add a `/deal/:id` (or slug-based, e.g. `/deal/redmi-note-13-5g-<id>`) detail route and page.
- Page should render: product title/H1, current price, MRP/strikethrough, discount %, "price dropped X% — was ₹Y" callout, source badge, rating, bank offers/coupon text, product image, a large "Get This Deal" CTA hitting the existing click endpoint, and — critically — the `Product`/`Offer` JSON-LD described in Finding 2.
- Link every `DealCard` title to this page (`<Link to={`/deal/${deal._id}`}>`) in addition to the existing buy button, so cards remain the fast path but a crawlable/shareable page exists underneath.
- Because deals expire/rotate (poller runs every 10 min per `apps/api/src/services/poller.ts`), design the page to gracefully handle an inactive/expired deal (`is_active: false`) by showing "This deal has expired" with links to similar/current deals in the same category — this itself is a good pattern competitors use to retain the URL's accumulated backlinks/rank rather than 404ing stale but well-linked pages.
- Use `previous_price`/`lowest_price`/`price_dropped_at` to render a simple price-history line ("Lowest price seen: ₹X on [date]") — cheap, unique, differentiating content per page.

---

## High

### 2. Zero Product/Offer schema anywhere — only Organization + WebSite on the homepage
**Evidence:** `apps/web/src/components/Seo.tsx` supports a generic `jsonLd` prop, but a repo-wide search shows it is only ever passed from `apps/web/src/pages/Home.tsx:18-37`, with `Organization` and `WebSite`/`SearchAction` types. `Category.tsx`, `Trending.tsx`, `PriceDrops.tsx` all render `<Seo title=... description=... path=... />` with no `jsonLd` at all. Rendered-page structured-data extraction on both `/` and `/category/Electronics` confirms `structured_data.block_count: 0` beyond what Home injects.

Even without per-deal pages (Finding 1), listing pages (`/category/:name`, `/trending`, `/price-drops`) can and should carry an `ItemList` schema referencing each visible deal, with nested `Product`/`Offer` (price, priceCurrency `INR`, availability, `url` — pointing at the deal permalink once it exists, or the listing page anchor as an interim step). Once Finding 1 ships, each `/deal/:id` page should carry a full `Product` + `Offer` block:
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "...",
  "image": "...",
  "offers": {
    "@type": "Offer",
    "price": "...",
    "priceCurrency": "INR",
    "url": "https://dealdost.shop/deal/...",
    "availability": "https://schema.org/InStock",
    "seller": { "@type": "Organization", "name": "Amazon.in" }
  },
  "aggregateRating": { ... }  // only if deal.rating is present — do not fabricate
}
```
Use `deal.rating` for `aggregateRating`/`review` only when present (many Telegram-sourced deals won't have it) — omit rather than stub, per Google's structured-data guidelines on missing review data.

### 3. No sitemap.xml / robots.txt — both routes return the raw SPA shell
**Evidence:** `curl https://dealdost.shop/robots.txt` and `curl https://dealdost.shop/sitemap.xml` both return the identical `index.html` document (title "DealDost — Best Amazon..."), i.e. there is no static `robots.txt` or `sitemap.xml` and the SPA's catch-all is serving both. This compounds Finding 1/2: even if per-deal pages existed, there is currently no sitemap mechanism to submit them, and category/trending/price-drops pages aren't declared either. (Flagging here because it's the mechanism that would carry per-deal URLs once they exist — full crawlability write-up is in the sitemap/technical findings; cross-reference `seo-sitemap-dealdost` and `seo-technical-dealdost`.)

**Recommendation:** Once per-deal permalinks exist, generate a dynamic XML sitemap (`/sitemap.xml`, served by the API, not the SPA fallback) covering the 8 category pages, `/trending`, `/price-drops`, and every active deal/product URL, with `<lastmod>` driven by `posted_at`/`price_dropped_at`. Deal URLs churn (poller cadence is 10 min), so keep the sitemap dynamically generated, not statically built at deploy time — and split into a static-pages sitemap + a frequently-regenerated deals sitemap so Google doesn't have to re-crawl the whole file to catch changes.

### 4. Pure client-side rendering with no SSR/prerendering — and the production origin is serving a Vite *dev* server
**Evidence:** Rendered HTML for both `/` and `/category/Electronics` contains `<script type="module">import { injectIntoGlobalHook } from "/@react-refresh"` and `<script type="module" src="/@vite/client">` — these are Vite's HMR/dev-mode injection markers, not present in a `vite build` production bundle. `raw_content` (pre-JS fetch) for `/` has an empty `<div id="root"></div>` — all content, meta tags (via `react-helmet-async`), and JSON-LD are injected client-side after JS execution.
This is a shared root cause across findings: with no static/SSR HTML, none of the per-page `<title>`, meta description, canonical, OG tags, or JSON-LD in `Seo.tsx` are present in the initial response — a crawler that doesn't execute JS (or a social-share unfurler) sees a generic empty shell.
**Recommendation:** This is primarily a technical/infra issue (cross-reference `seo-technical-dealdost` for the dev-mode-in-production finding specifically), but from the e-commerce/schema angle: prioritize at minimum prerendering or SSR for deal detail pages once built (Finding 1) and category pages, since these are the pages meant to rank for product/price queries and to unfurl correctly when links are shared in the Telegram channel itself or on social media.

---

## Medium

### 5. Google Shopping / Merchant Center — not applicable in current form, but a comparison-content play exists
DealDost does not sell or fulfill; it has no shippable inventory, returns policy, or checkout, so a standard Merchant Center product feed (which requires the merchant to be the seller of record) is **not applicable** — do not build a Merchant Center feed for DealDost's own listings.
What *is* available and underused: the `GET /v1/feed/compare` endpoint (`apps/api/src/routes/feed.ts:257-291`) and `CompareModal.tsx` already aggregate multiple sources/offers per product and flag the lowest price (`is_lowest`). This is exactly the "price comparison" content model Google rewards in shopping-intent SERPs (comparison shopping engines / "where to buy" content) — but it's currently only reachable via a client-fetched modal (`onClick={() => setShowCompare(true)}`, `DealCard.tsx:188-193`), invisible to crawlers and with no dedicated URL. Once per-deal pages exist (Finding 1), fold the comparison data directly into the page as static-rendered content (not a modal) with `AggregateOffer` schema (`lowPrice`/`highPrice`/`offerCount`) — this is the closest fit to "Merchant Center-style" visibility available to an aggregator with no owned inventory.

### 6. Price-drop feed is a live data view, not indexable content
**Evidence:** `apps/web/src/pages/PriceDrops.tsx` and `GET /v1/feed/price-drops` (`apps/api/src/routes/feed.ts:188-227`) power a solid feature — a 14-day rolling window of products whose live price fell, deduped by `affiliate_url`. This is genuinely valuable, differentiated content (few aggregators track real price history), but today it's exposed only as one generic listing page with static copy ("Products that just got cheaper — grab them before prices bounce back") and no unique per-item URL, so none of the individual price-drop events are indexable or shareable ("Redmi Note 13 price dropped 18% today" is exactly the kind of query this data could rank for, but there's no page to rank).
**Recommendation:** Once Finding 1 ships, every product with a `price_dropped_at` should have its price-drop framing (percent, previous price, date) surface on its own `/deal/:id` page as the hero content, not just a badge in a grid card. Consider also a lightweight, real per-drop history array (even just last 3-5 observed prices) if the data model can support it cheaply — this is the single most defensible content moat vs. generic deal-reposting competitors.

### 7. Category pages are thin — grid only, near-duplicate meta pattern across all 8 categories
**Evidence:** `apps/web/src/pages/Category.tsx:15-19` — title `Best ${name} Deals Today`, description `Latest ${name} deals and discounts from Amazon & Flipkart, updated daily on DealDost.` This is a fine minimum-viable template, but with 8 categories (`VALID_CATEGORIES` in `apps/api/src/routes/feed.ts:48`) the pages are otherwise identical: an `<h1>` + a card grid, no supporting copy, no subcategory/filter links, no "why shop Electronics deals here" context, no schema beyond the (currently absent) `ItemList`.
**Recommendation:** Add category-specific intro copy (1-2 sentences, can be static/hardcoded per category — doesn't need to be dynamic) and an `ItemList` schema over the rendered cards (Finding 2). Consider surfacing category-level facts pulled from real data you already have (e.g. "127 active Electronics deals, avg. discount 34% this week") — cheap to compute server-side, adds genuine unique content per category page, and reinforces freshness signals.

### 8. No affiliate-relationship disclosure anywhere in the UI
**Evidence:** repo-wide search for disclosure/affiliate-disclaimer/commission language in `apps/web/src` returns no matches. `DEFAULT_DESCRIPTION` in `Seo.tsx:5-6` and all page copy market the site purely as a deals feed with no "we may earn a commission" disclosure.
This isn't a ranking-algorithm factor directly, but Google's product-review/affiliate content guidance (and FTC/ASCI disclosure expectations for affiliate marketing in general) increasingly correlates with how "helpful content" classifiers treat affiliate sites, and it's standard practice on ranking deal-aggregator competitors. Cheap to add (footer line + on each future deal page), non-trivial downside if absent at scale.

---

## Low

### 9. Product images are hotlinked directly from Amazon/Flipkart, no local optimization control
**Evidence:** `deal.image_url` is rendered directly (`DealCard.tsx:94-101`, `CompareModal.tsx:85-86`) with no proxy/CDN rewrite, no explicit `width`/`height` attributes (CLS risk), and no `alt` text beyond the raw scraped title (acceptable, but not always descriptive — e.g. titles with marketplace boilerplate like "Buy X Online at Best Price..." per the stopword list in `apps/api/src/routes/feed.ts:229-234` suggest titles themselves aren't always clean).
**Recommendation:** Not urgent given the aggregator model (you don't own these images), but consider: (a) setting explicit `width`/`height` on `<img>` to prevent layout shift, (b) a lightweight image proxy/cache if hotlinked source images ever break/rate-limit (affects both UX and any future image search-indexing), (c) reusing `compareQuery`'s title-cleaning logic (or similar) to also clean the *displayed* title, not just the search index, for stronger on-page relevance signals.

### 10. Coupon/bank-offer content has no structured markup
**Evidence:** `coupon_text` and `bank_offers` (`DealCard.tsx:156-169`) are valuable, unique text snippets per deal (e.g. specific bank discount terms) but are plain rendered strings with no schema. Low priority until Finding 1 ships, but on future deal pages, plain visible text is sufficient — no dedicated schema type fits "coupon text" well (avoid over-marking with unsupported `Coupon` types not in Google's supported vocabulary); just ensure the text renders as real DOM text (it already does) so it's crawlable once pages are indexable.

---

## Summary of priorities

| Priority | Finding | Effort | Impact |
|---|---|---|---|
| Critical | Add per-deal permalink pages (`/deal/:id`) | Medium (data already exists via `GET /v1/deals/:id`, `/v1/products/:id`) | Very high — unlocks all downstream schema/indexing work |
| High | Add `Product`/`Offer`/`ItemList` JSON-LD to listing + future detail pages | Low once Finding 1 exists | High |
| High | Generate dynamic `/sitemap.xml` covering categories + deal URLs | Medium | High |
| High | Resolve dev-server-in-production / add SSR or prerendering for indexable pages | Medium-high (infra) | High — cross-cutting with technical audit |
| Medium | Surface `feed/compare` data as static on-page content with `AggregateOffer` | Low-Medium | Medium |
| Medium | Turn price-drop data into per-deal hero content | Low (data exists) | Medium-high |
| Medium | Add category intro copy + live stats | Low | Medium |
| Medium | Add affiliate disclosure | Very low | Low-medium (trust/compliance) |
| Low | Image CLS/proxy, title cleanup | Low | Low |
