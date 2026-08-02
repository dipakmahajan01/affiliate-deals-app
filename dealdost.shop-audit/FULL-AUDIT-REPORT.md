# Full SEO Audit — dealdost.shop

**Audited:** 2026-08-02/03 | **Business type:** E-commerce / Affiliate deals aggregator (Amazon & Flipkart deals sourced from Telegram) | **Stack:** React + Vite SPA, react-router-dom client-side routing, no SSR/prerendering, Express/MongoDB API, nginx 1.28.3 (Ubuntu)

## SEO Health Score: 20 / 100

| Category | Weight | Score |
|---|---|---|
| Technical SEO | 22% | 22/100 |
| Content Quality | 23% | 15/100 |
| On-Page SEO | 20% | 15/100 |
| Schema / Structured Data | 10% | 10/100 |
| Performance (CWV) | 10% | 54/100 |
| Images | 5% | 35/100 |
| AI Search Readiness | 10% | 10/100 |

Supplementary (not weighted into the score above): E-commerce/Affiliate Model 20/100, Search Experience (SXO) Gap Score 8/100, Backlinks — insufficient data (expected for a brand-new domain).

---

## Executive Summary

Nearly every finding in this audit traces back to a single root cause: **the production domain is serving the raw Vite development server, not a built production bundle.** Confirmed directly — the live HTML contains `/@react-refresh` and `/@vite/client` HMR injections, and unbundled TypeScript source (`/src/main.tsx`) returns HTTP 200 to any visitor, including one instance where a dependency response leaked an internal server path (`/@fs/home/ubuntu/affiliate-deals-app/node_modules/...`).

This single deployment defect cascades into most of the other critical findings:
- **No meta tags, canonical, or JSON-LD reach the live page** — the code for all of these already exists in the repo (`Seo.tsx`, `Home.tsx`'s Organization/WebSite schema) but is running against a stale, pre-metadata checkout.
- **LCP is 16-17 seconds** (6.5x over the "poor" threshold) — 90% of that time is spent resolving unbundled dev-mode JS module chains before the browser even starts fetching the actual LCP image.
- **robots.txt and sitemap.xml are unreachable** — both return HTTP 200 but serve the SPA shell, because no static file in `apps/web/public/` is served in production at all (even binary files like favicons come back as `text/html`).
- **AI crawlers see nothing** — GPTBot, ClaudeBot, and PerplexityBot were tested directly and all received an identical 709-byte empty `<div id="root"></div>` shell.

**The good news:** every subagent independently confirmed this is a *deployment* problem, not primarily a code problem. The team has already written the SEO-relevant code (meta tag management, Organization/WebSite schema, a well-formed robots.txt/sitemap.xml in the repo) — it simply has never been deployed. Fixing the build/deploy pipeline (`vite build` → static serve, not `vite dev`) is expected to resolve or unblock a large fraction of the findings below with no new application code.

The second-largest structural gap, independent of the deployment issue, is that **no individual deal ever gets its own URL.** Every deal is a card inside a listing page with no permalink, no `<a href>`, and no way to attach Product/Offer schema. The backend already exposes full per-item data (`GET /v1/deals/:id`, `GET /v1/products/:id` — price, discount %, rating, coupon text, bank offers) so this is a comparatively cheap frontend/routing fix with very high payoff: it's what most successful deal-aggregator competitors use to rank for long-tail "[product] deal" queries, and it's the single change every subagent (technical, content, schema, e-commerce, SXO, GEO) independently flagged as highest-leverage after the deployment fix.

A third finding worth calling out on its own: **there is no FTC/ASCI affiliate disclosure anywhere on the site**, and no About/Privacy/Terms/Contact pages exist in the codebase at all — not just missed on this crawl. This is a compliance gap as much as an SEO one.

---

## Top 5 Critical Issues

1. **Production is running the Vite dev server, not a build.** Root cause of most other findings. Fix: `pnpm --filter @deals/web build` deployed behind nginx.
2. **No per-deal/product permalink pages exist.** Blocks indexing, schema, sharing, and AI citation of individual deals. Backend data already supports it.
3. **robots.txt and sitemap.xml are both unreachable** (served as the SPA shell) — zero crawl directives or sitemap signal reach any search engine today.
4. **Zero FTC/ASCI affiliate disclosure, and no About/Privacy/Terms/Contact pages exist anywhere in the codebase.**
5. **LCP is 16-17 seconds** — a direct, measured consequence of issue #1.

## Top 5 Quick Wins

1. Deploy the production build behind nginx — unblocks meta tags, canonical, favicon/manifest, and already-coded Organization/WebSite JSON-LD for free.
2. Fix nginx to serve static files before the SPA catch-all — the repo's existing `robots.txt`/`sitemap.xml` just need to reach a crawler.
3. 301-redirect `www.dealdost.shop` → apex (TLS cert already covers both hosts).
4. Add standard security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) via nginx.
5. Remove `loading="lazy"` from the first above-the-fold product card image (the current LCP element).

---

## Technical SEO (22/100)

**What works:** HTTPS redirect is correct and TLS covers both hosts; mobile viewport tag is present; content is eventually renderable by a JS-executing crawler (not a hard block, a timeout risk).

**Critical**
- Production is running the Vite dev server, not a build (`/@vite/client`, `/@react-refresh`, unbundled `/src/main.tsx` all return 200).
- robots.txt/sitemap.xml both return the SPA shell — nothing valid exists at either URL.
- No canonical tag, meta description, or per-route title anywhere in raw HTML — all 9 routes tested are byte-identical.
- No indexable per-deal URLs exist.

**High**
- `www.dealdost.shop` serves duplicate content with no redirect and no canonical.
- Missing all standard security headers (HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
- No structured data anywhere on the live site.

**Medium**
- Favicon/manifest assets soft-404 to the SPA shell.
- Unknown paths return 200 with the homepage shell (soft-404, no noindex signal).

Full detail: `findings/technical.md`

## Content Quality (15/100)

**What works:** Above-the-fold copy is clear once rendered; real, differentiated product data already exists in the backend (price, discount %, price-drop %, rating, coupon text, bank offers).

**Critical**
- No individual deal/product pages exist.
- SEO metadata is coded (`Seo.tsx`, react-helmet-async) but never reaches the live page — same root cause as Technical #1.
- Zero FTC/ASCI affiliate disclosure; no About/Privacy/Terms/Contact routes exist at all.

**High**
- Category pages carry no unique content beyond a templated one-line heading.
- Deal "content" is verbatim marketplace copy with no original commentary.
- No Product/Offer/ItemList schema exists even in source.

**Medium**
- Inconsistent client-side hydration — `/category/electronics` didn't finish loading deal cards within a 16s render budget while `/trending` did.
- Duplicate content risk from unmodified, widely-republished marketplace titles.

Full detail: `findings/content.md`

## On-Page SEO (15/100)

- Identical `<title>` and no meta description on every route in raw HTML (Critical).
- No heading hierarchy — 0 `<h1>`, 0 `<h2>` found on rendered pages (High).
- No internal linking to individual deals — `DealCard` uses `onClick`, not `<a href>` (High).

## Schema & Structured Data (10/100)

**What works:** Organization + WebSite (with SearchAction) JSON-LD is already correctly authored in `Home.tsx` and passes validation checks; `Seo.tsx` has a working `jsonLd` prop mechanism.

- Zero JSON-LD reaches the live site on any route — deployment issue, not an authoring issue (Critical).
- No BreadcrumbList on category pages (High, trivial to add).
- No ItemList on listing pages (Medium).
- Full Product/Offer schema depends on per-deal permalink pages shipping first (Info/roadmap).

Full detail: `findings/schema.md` (includes ready-to-use JSON-LD for all three).

## Performance / Core Web Vitals (54/100 Lighthouse, but LCP is Critical)

**What works:** CLS = 0 on both routes; TBT is 120-130ms, well under the "good" threshold.

- **LCP is 16.1s (home) / 17.2s (trending)** — ~6.5x over the "poor" threshold. 90% of the LCP time on `/trending` is "Load Delay" resolving unbundled JS chains (Critical).
- Static JS assets served without gzip/brotli compression — 928KB largest chunk served completely uncompressed (High).
- LCP element (`loading="lazy"` on the first above-the-fold product image) delays its own fetch (High).
- TTFB is borderline (230-744ms) — re-verify after the deploy fix (Medium).

Full detail: `findings/performance.md` (raw Lighthouse JSON also saved alongside).

## Images (35/100)

- LCP candidate image is lazy-loaded (cross-referenced with Performance, High).
- Product images are hotlinked directly from Amazon/Flipkart with no local optimization/CDN control and no explicit width/height (Low).
- Alt text is raw scraped marketplace title, not always clean (Low).

## AI Search Readiness / GEO (10/100)

- AI crawlers that don't execute JavaScript (GPTBot, ClaudeBot, PerplexityBot — tested directly by User-Agent) see nothing but an empty shell (Critical).
- No real robots.txt or llms.txt — well-known AI-crawler paths fall through to the SPA shell (Critical).
- No permalink URL per deal blocks AI citation structurally, independent of the rendering fix (Critical).
- No meta description, Open Graph, or Twitter Card tags anywhere — also breaks link previews when DealDost URLs are shared on Telegram/WhatsApp/Twitter (High).

Full detail: `findings/geo.md` (includes a platform-specific readiness table for Google AI Overviews, ChatGPT, Perplexity, and Bing Copilot).

---

## Supplementary Analysis

### E-commerce / Affiliate Model (20/100 — not part of weighted score)

DealDost owns no inventory or checkout, so Google Merchant Center is correctly not applicable — it's scored against deal-aggregator competitors instead. The backend already has everything needed for per-deal pages (`GET /v1/deals/:id`, `GET /v1/products/:id`), making that fix cheap relative to its payoff. The existing price-comparison feature (`GET /v1/feed/compare`) is currently trapped in a client-only modal, invisible to crawlers. Full detail: `findings/ecommerce.md`.

### Search Experience / SXO (Gap Score 8/100 — not part of weighted score)

Every route returns a byte-identical `<head>` with zero deal content in extracted text, even after a 16-17s render wait — Google has no differentiated page types to match against any target query cluster. The highest-priority persona gap: someone following a shared link to one specific deal scores ~8/100 because no permalink exists to land them on it. Full detail: `findings/sxo.md`.

### Backlinks & Authority (insufficient data — not part of weighted score)

Tier 0 analysis (Common Crawl only). The domain is entirely absent from Common Crawl's index, which is expected and normal for a brand-new site — not a red flag. Recommendations focus on link acquisition (deal/coupon directories, cross-promotion with source Telegram channels) rather than cleanup. Full detail: `findings/backlinks.md`.

### Visual / UX

Screenshots captured for desktop and mobile on `/` and `/trending` (see `screenshots/`). The rendered UI itself is well-designed and content-forward once it loads — issues found were secondary: a horizontally-scrolling mobile category nav with no visual affordance, and several touch targets below the 44px recommended minimum. Full detail: `findings/visual.md`.

---

## Artifacts

- `findings/technical.md`, `content.md`, `schema.md`, `sitemap.md`, `performance.md`, `visual.md`, `geo.md`, `ecommerce.md`, `sxo.md`, `backlinks.md`
- `screenshots/` — desktop + mobile captures of `/` and `/trending`
- `performance` raw Lighthouse reports referenced in `findings/performance.md`
- See `ACTION-PLAN.md` for the prioritized, phased remediation plan.
