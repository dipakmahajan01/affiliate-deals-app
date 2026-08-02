# Search Experience Optimization (SXO) Audit — dealdost.shop

**SXO Gap Score: 8 / 100** (separate from SEO Health Score — measures whether the experience matches what searchers/Google expect for the target intents)

## Evidence base

- Rendered (Playwright, `--mode auto`/`--mode always`, ~16–17s render wait) and parsed `/`, `/category/electronics`, `/trending`, `/price-drops`.
- All routes return **byte-identical** `<head>` content: same `<title>DealDost – Best Amazon & Flipkart Deals from Telegram</title>`, no `<meta name="description">`, no canonical, 0 `<h1>`, 0 `<h2>`, 0 images, 0 schema blocks, 8-word static word count.
- Even after full JS render, the extractable text on `/` and `/price-drops` contains **only the nav chrome and hero copy** ("Deal Dost… Best Deals, Handpicked For You… 🔥 See Trending Deals Latest Deals") — **zero actual deal/product content** (no product names, prices, discount %, merchant names) appeared in the boilerplate-stripped rendered text on either route, despite a 16+ second render wait and no console errors. This means the one thing users and Google actually search for — the deals themselves — isn't reliably present in what a crawler/renderer captures.
- No per-deal permalinks exist anywhere in the app (confirmed via CLAUDE.md architecture notes and route list: `/`, `/category/:name`, `/digest`, `/search`, `/trending`, `/price-drops`, `/assistant`, `/login`, `/signup` — no `/deal/:id`).

## Primary finding: total page-type mismatch (CRITICAL)

Google doesn't have one "deals site" template — it rewards different page types per query cluster. I searched the four query clusters DealDost would plausibly target:

| Query | What Google actually ranks | DealDost's current page |
|---|---|---|
| "best amazon deals today" | Deal-aggregator **listing pages** with live grids of individual deals (price, % off, retailer badge), updated on a visible cadence — Ben's Bargains, Jungle.deals, TheFreebieGuy — plus editorial roundups (TechRadar "Today's best Amazon deals: Echo, Fire tablets…") | Client-only SPA shell; no deal content renders into crawlable text |
| "flipkart price drop deals" | **Price-tracking pages** with price-history charts and dedicated, indexable product/price-drop pages — PriceBefore `/price-drops/`, BuyHatke, PriceHistory.app — several with named per-product URLs | `/price-drops` route serves the identical shell as `/`; no per-product URL, no price history |
| "[category] deals today" (e.g. "electronics deals today") | Retailer **category landing pages** (Amazon, Best Buy, Target) or aggregator category pages with SSR'd/static grids (Slickdeals `/deals/tech/`, DealNews `/c142/Electronics/`) | `/category/electronics` is the same shell as every other route — no category-specific title, heading, or content |
| "amazon deals telegram channel" | **Directory/informational pages** listing and describing Telegram deal channels (telegramchannels.me, Quora answers, t.me channel pages) | No content type on the site addresses this intent at all — DealDost is downstream *of* Telegram, not a channel directory, so this query cluster is likely not winnable without a dedicated "about our Telegram sourcing" page |

**Severity: CRITICAL.** This isn't a page-type mismatch in the usual sense (wrong format on an otherwise-indexable page) — it's a total absence of differentiated, crawlable page types. Every URL on the site is functionally the same document to Google: identical `<title>`, no meta description, no headings, no deal text. There is nothing for the algorithm to match against any of the four intent clusters, because there's no unique content signal per query cluster to begin with. This should be treated as the umbrella finding that the technical/schema/content agents' route-level issues all roll up into: **the SPA has no page types, only one shell reused across every route.**

## User stories and persona scoring

Derived from the SERP signals above (bargain-hunter behavior on aggregator sites, price-tracker usage patterns, category-browsing on retailer deal pages, and Telegram-channel-discovery search behavior).

### 1. The specific-product bargain hunter
*"Is there a good deal on [product] right now?"* — arrives via a category or product-name search, expects a page like Slickdeals/DealNews with a filterable/searchable grid and per-item pricing.
- **Relevance:** 2/25 — no indexable page exists for any specific product; `/search` is client-only.
- **Clarity:** 2/25 — nothing renders for a crawler or a no-JS/slow-JS visitor to read.
- **Trust:** 3/25 — no price history, no "last verified" timestamp, no schema (Product/Offer) to back up claims.
- **Trust:** no reviews/ratings surfaced, no expiry/validity window shown.
- **Action:** 5/25 — the click-through flow itself works once a human loads the SPA, but nothing gets them there from search.
- **Total: ~12/100 — Severely underserved.**

### 2. The daily browser ("what's new today")
*"Show me today's best deals"* — matches "best amazon deals today" intent; expects a live-updating list they can skim daily, ideally bookmarked or returned to directly from a Google result for "today."
- **Relevance:** 5/25 — homepage concept is right (a live feed), but nothing about "today" is expressed in indexable content (no date-stamped headline, no freshness signal Google can read).
- **Clarity:** 3/25 — as shown above, the deal grid itself doesn't appear in rendered/extracted text, so even a returning visitor relying on search to re-find "today's deals" gets a blank shell in preview/cache contexts.
- **Trust:** 4/25 — "Updated Daily" is asserted in the hero copy but not backed by any visible timestamp or schema (`dateModified`).
- **Action:** 6/25 — CTA ("🔥 See Trending Deals") exists but only functions after full client hydration.
- **Total: ~18/100 — Poorly served.**

### 3. Someone who followed a shared/social link for one specific deal
*Clicked a link from Telegram/WhatsApp/a social post expecting to land on that exact deal* — this is arguably DealDost's highest-intent, highest-conversion persona, and the SERP-equivalent expectation (from price-tracker sites) is a dedicated page for that one item with price, discount, and a clear "Buy Now" affiliate CTA.
- **Relevance:** 1/25 — **there is no URL for this to exist.** Per CLAUDE.md, there are no per-deal permalinks; every share necessarily points to `/`, `/category/:name`, or `/trending`, so the specific deal the person wants is not guaranteed to be visible or findable on landing.
- **Clarity:** 1/25 — the recipient has to manually re-find the item in a live-only feed.
- **Trust:** 3/25 — no per-deal metadata (price at time of share, expiry) to confirm the deal is the same one shared.
- **Action:** 3/25 — no direct CTA; the affiliate click flow only becomes reachable after they've re-located the item.
- **Total: ~8/100 — This persona is effectively unaddressed. Highest-priority fix.**

### 4. The "is this really a good price" verifier
*Wants price history/context before buying* — matches "flipkart price drop deals" intent served by PriceBefore/BuyHatke-style pages with historical charts.
- **Relevance:** 3/25 — `/price-drops` exists conceptually but is content-free to a crawler and has no historical chart or context (just "price_drop_percent" computed server-side, not surfaced as verifiable history).
- **Clarity:** 3/25 — one-line subhead only in rendered text; no supporting data.
- **Trust:** 2/25 — no price-history schema/data, no source citation, nothing to differentiate "price drop" claims from marketing copy.
- **Action:** 5/25 — CTA flow works once loaded, but nothing pre-purchase reassures the verifier persona.
- **Total: ~13/100 — Poorly served.**

### 5. The "find a Telegram deals channel" discoverer
*Searching to find/join deal channels, not necessarily to buy from a web app.*
- **Relevance:** 1/25 — DealDost doesn't publish anything positioning it in this space (no "how we source deals" or channel-directory content).
- **Total: not competitively addressable without new content**; recommend deprioritizing unless there's a strategic reason to capture this traffic (e.g., to funnel Telegram-channel searchers to the web app).

## Recommendations (ranked by persona impact)

1. **Add per-deal permalinks (`/deal/:id`) with server-rendered/pre-rendered content** — highest priority. This single change unlocks personas 1 and 3 (the two highest-intent personas) and gives Google actual page types to match against "best amazon deals today" / "flipkart price drop deals" query clusters. Cross-ref `/seo technical` and `/seo schema` for SSR/prerendering and Product+Offer schema implementation.
2. **Differentiate category pages** (`/category/:name`) with unique `<title>`, `<h1>`, meta description, and category-specific intro copy so `/category/electronics` can independently compete for "[category] deals today" — currently indistinguishable from every other route.
3. **Surface freshness signals** (visible last-updated timestamp per deal/category, `dateModified` in schema) to support the "daily browser" persona and back up the "Updated Daily" claim already in the hero copy.
4. **Ensure deal content actually renders into the crawlable DOM/extracted text**, not just after additional lazy-load/scroll interactions — the rendering test above (16s wait, no console errors) never surfaced product names or prices on `/` or `/price-drops`. If deals are fetched via an API call that only resolves after further user interaction (scroll, intersection observer), this is a rendering-budget risk for Googlebot too — flag to `/seo technical` for confirmation via network-log inspection.
5. Deprioritize the Telegram-channel-discovery query cluster unless there's a business reason to capture it; it doesn't align with any of the app's existing page types.

## Limitations

- This audit used a headless renderer with a fixed wait (~16-17s); it cannot rule out that deal cards appear only after user interaction (scroll-triggered fetch) that Googlebot may or may not simulate. Recommend the technical/performance agents confirm via network waterfall whether the deals API call fires on initial render or requires interaction.
- Persona/user-story scores are derived from SERP-signal inference (standard SXO methodology), not from actual user research or analytics for this property — treat relative gaps (which persona is worst-served) as more reliable than the absolute point totals.
- Did not evaluate `/digest`, `/search`, `/assistant`, `/login`, `/signup` in the rendering pass — routing pattern observed on 4 routes strongly suggests they share the same shell, but this wasn't independently re-verified for each.
- No access to Search Console data, so cannot confirm actual current rankings/impressions for the target query clusters — findings are based on SERP composition + page-type inference, standard for a pre-launch/limited-index property.

**Cross-references:** page-type fix requires SSR/prerendering (`/seo technical`), Product/Offer schema per deal (`/seo schema`), and thin-content remediation for category pages (`/seo content`). Recommend generating a PDF report via `/seo google report` once all subagent findings are aggregated.
