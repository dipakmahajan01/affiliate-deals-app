# GEO / AI Search Readiness Audit — dealdost.shop

**Audited:** 2026-08-02 (site date, per response headers) | **Method:** raw `curl` with AI-crawler user agents (GPTBot, ClaudeBot, PerplexityBot), Playwright-rendered fetch, DNS/header inspection.

## GEO Health Score: 10 / 100 (Critical)

| Dimension | Weight | Score | Notes |
|---|---|---|---|
| Citability | 25% | 5/100 | Zero content in raw HTML; nothing for non-JS crawlers to cite |
| Structural Readability | 20% | 10/100 | No heading hierarchy, no schema, unstructured text blob when rendered |
| Multi-Modal Content | 15% | 15/100 | Product images exist but only reachable post-JS |
| Authority & Brand Signals | 20% | 10/100 | No meta/OG/Twitter tags anywhere; no discoverable brand presence found |
| Technical Accessibility | 20% | 10/100 | Production is serving the Vite **dev server**, not a build; every well-known path (robots.txt, llms.txt, sitemap.xml) falls through to the SPA shell |

---

## Critical Findings (P0)

### 1. Production is serving the Vite dev server, not a built bundle
`curl https://dealdost.shop/` returns:
```html
<script type="module">import { injectIntoGlobalHook } from "/@react-refresh";
injectIntoGlobalHook(window);
...
<script type="module" src="/@vite/client"></script>
...
<script type="module" src="/src/main.tsx"></script>
```
This is Vite's HMR dev-mode shell (`@react-refresh`, `@vite/client`, unbundled `/src/main.tsx`), not a production `vite build` output. This is the root cause of nearly every other issue below: it means there is no prebuilt/optimized bundle, no code-splitting, and (per the Playwright render trace) **16.2 seconds** to first meaningful paint (`render_ms: 16214` in our render trace) — that's serving raw, unbundled ES modules over the network and compiling in-browser. This exceeds the render budget of essentially every crawler, including Google's, which is comparatively generous.
- **Impact:** Blocks all downstream GEO work. Fix this before anything else — items 2-7 are partially moot until real content ships in the response.
- **Fix:** Confirm the deploy pipeline runs `pnpm --filter @deals/web build` and nginx serves `apps/web/dist/`, not a `vite dev`/`vite` process. **Effort: Low** (deploy config fix, not app code).

### 2. AI crawlers that don't execute JavaScript see nothing
GPTBot, OAI-SearchBot, PerplexityBot, and (per public docs) most non-Google crawlers do not execute JavaScript. Raw response body for `/` is 709 bytes total:
```html
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```
No `<h1>`, no product data, no text of any kind. Confirmed identical empty shell returned regardless of `User-Agent` (tested `GPTBot`, `ClaudeBot`, `PerplexityBot` — all 200 OK, same 709-byte body). By contrast, our Playwright-rendered fetch (`is_spa: true`) extracted real content only after full JS execution:
> "Updated Daily / Best Deals, Handpicked For You / Savings from Amazon, Flipkart & more — all in one place / 🔥 See Trending Deals / Latest Deals / Vega Voyager Full Face Riding Helmet..."
- **Impact:** ChatGPT/OAI-SearchBot and PerplexityBot effectively cannot see or cite any DealDost content today. Google AI Overviews (Googlebot renders JS) may fare better but is still exposed to the 16s render time and zero structural signals.
- **Fix:** Once item 1 is fixed, evaluate SSR/prerendering (e.g., a prerender-on-bot-UA middleware, or migrating hot paths to a framework with SSR) so first-response HTML contains real deal content, headings, and text. **Effort: Medium.**

### 3. No real robots.txt — SPA catch-all serves index.html for every well-known path
`/robots.txt`, `/llms.txt`, `/sitemap.xml`, and `/ai.txt` all return **HTTP 200** but are byte-identical to the homepage shell (same dev-mode `<head>`, same `<div id="root">`). There is no static-file serving happening before the SPA fallback route catches everything.
- **Impact:** No explicit allow/disallow signal exists for any AI crawler today. Default behavior (full access) is not necessarily bad, but the absence of an explicit `Allow: GPTBot` / `Sitemap:` directive is a missed, trivial win, and the catch-all masks any future attempt to add one until static-file precedence is fixed.
- **Fix:** Ensure static files in `apps/web/public/` (or nginx `try_files`) are served **before** the SPA fallback. Add a real `robots.txt` with explicit `User-agent: GPTBot / OAI-SearchBot / ClaudeBot / PerplexityBot → Allow: /` plus a `Sitemap:` line. **Effort: Low**, but blocked on item 1 (deploy is not serving static assets from the built output at all).

### 4. No llms.txt
Confirmed missing — same catch-all shell returned. Not actionable as a standalone fix until item 3 is resolved (static-file serving), since any file dropped in `public/llms.txt` will currently be shadowed by the SPA route.
- **Fix:** Once static serving works, add `/llms.txt` summarizing DealDost's purpose, key routes (`/trending`, `/category/:name`, `/price-drops`), and noting the current lack of per-deal permalinks (see item 5) so AI systems understand what they can and can't cite. **Effort: Low.**

---

## Structural Blocker (P0 — same root cause flagged for classic SEO)

### 5. No permalink URL per deal
Deals exist only as cards rendered client-side on listing pages (`/trending`, `/category/:name`, `/price-drops`). There is no `/deal/:id` (or similar) route with a stable, linkable, individually-citable URL.
- **Impact:** Even after fixing rendering (items 1-2), an AI answer engine that wants to cite "the Vega Voyager Full Face Riding Helmet deal on DealDost" has **no URL to link to** — only the aggregate listing page, which changes over time (per `poller.ts`'s 10-minute polling cycle and dedup upserts) and doesn't correspond to any single product. This is a structural blocker equally damaging to classic SEO and GEO: no unit of content exists that is stable enough to be indexed, cited, or linked to.
- **Fix:** Add a per-deal detail route (e.g., `/deal/:id`) with server-rendered `<title>`, meta description, OG tags, and JSON-LD `Product`/`Offer` schema (price, price-drop %, source channel). Reuse existing `Deal` schema fields already in MongoDB. **Effort: Medium** — new route + component + SSR/prerender handling, but no new backend work since `GET /v1/deals/:id`-equivalent data already exists.

---

## Secondary Findings (P1)

### 6. No meta description, Open Graph, or Twitter Card tags anywhere
The entire `<head>` (raw or rendered) contains only `charset`, `viewport`, `theme-color`, and `<title>`. No `<meta name="description">`, no `og:title`/`og:image`/`og:description`, no `twitter:card`. This directly hurts authority-signal scoring and AI Overview / Bing Copilot snippet quality, and (as an aside) will produce ugly link previews when DealDost URLs are shared anywhere (Telegram, Twitter, WhatsApp) — ironic given the product's own distribution channel is Telegram.
- **Fix:** Add static or dynamically-injected meta description + OG/Twitter tags per route. **Effort: Low-Medium** (trivial for static routes, needs SSR for per-deal dynamic tags once item 5 ships).

### 7. Zero structured data (JSON-LD) anywhere
Our render check (`structured_data.block_count: 0`) found no schema.org markup at all — no `Product`, `Offer`, `BreadcrumbList`, `WebSite`, or `Organization` schema. This is a missed entity/authority signal for both classic SEO and AI answer engines that use structured data to ground citations.
- **Fix:** Add `WebSite`/`Organization` schema site-wide, and `Product`/`Offer` schema per deal once permalinks exist. **Effort: Low** for site-wide, **Medium** tied to item 5 for per-deal.

---

## Brand Mention Signals (inconclusive — recommend deeper check with dedicated tooling)
A quick web search for `"DealDost" telegram deals` returned no visible Wikipedia, Reddit, YouTube, or LinkedIn presence in the fetched result snippet (search-engine result page itself didn't surface listings in the fetch — this should be treated as inconclusive, not confirmed-absent, and re-checked with a proper SERP API or DataForSEO if available). Given brand mentions on YouTube (~0.737 correlation) and Reddit correlate most strongly with AI citation likelihood, and no such presence was found in this pass, this is worth a follow-up with better tooling before treating it as a confirmed gap.

---

## Platform-Specific Readiness (estimated)

| Platform | Score | Rationale |
|---|---|---|
| Google AI Overviews | ~30/100 | Googlebot renders JS so may eventually see content, but 16s render time + zero schema/meta severely limits snippet quality |
| ChatGPT / OAI-SearchBot | ~5/100 | No JS execution → sees empty 709-byte shell only |
| Perplexity | ~5/100 | No JS execution (per public docs) → same empty shell |
| Bing Copilot | ~15/100 | Partial/limited JS rendering, same structural deficits |

---

## Top 5 Highest-Impact Fixes (priority order)

1. **Fix the production deploy to serve a real `vite build` output, not the dev server.** (Effort: Low — deploy config, not app code) — unblocks everything else.
2. **Ensure static files (`robots.txt`, `llms.txt`, `sitemap.xml`) are served before the SPA fallback route, then add real versions with explicit AI-crawler allow rules.** (Effort: Low)
3. **Add SSR or prerender-on-bot-UA for initial HTML so non-JS crawlers (GPTBot, PerplexityBot) get real text content.** (Effort: Medium)
4. **Add per-deal permalink routes (`/deal/:id`) with server-rendered meta tags + JSON-LD `Product`/`Offer` schema.** (Effort: Medium) — structural blocker shared with classic SEO.
5. **Add site-wide meta description/OG/Twitter tags and `WebSite`/`Organization` schema.** (Effort: Low)
