# SEO Action Plan — dealdost.shop

Prioritized by severity and dependency order. Most Phase 1 items are deployment/infra fixes, not application code — they unblock code that has already been written.

---

## Phase 1: Critical Fixes (Week 1)

- [ ] **Deploy a production build instead of the Vite dev server.** Run `pnpm --filter @deals/web build` and serve `apps/web/dist/` via nginx (or another static host) instead of running `vite`/`pnpm dev` in production. This is the single highest-leverage fix in this audit — it directly resolves or unblocks the meta-tag, canonical, favicon/manifest, and Organization/WebSite JSON-LD findings below with no new application code.
- [ ] **Fix nginx static-file routing** so real files in `apps/web/public/` (or `dist/`) — `robots.txt`, `sitemap.xml`, icons, `manifest.json` — are served before the SPA's `try_files ... /index.html` fallback. Example pattern:
  ```nginx
  location / {
    try_files $uri $uri/ /index.html;
  }
  ```
- [ ] **301-redirect `www.dealdost.shop` → `https://dealdost.shop`.** TLS cert already covers both hosts, so this is a pure nginx/DNS config change.
- [ ] **Add a footer with FTC/ASCI affiliate disclosure, About, Privacy Policy, Terms, and a real Contact method.** No route for any of these currently exists in `App.tsx` — this is a compliance gap, not just an SEO one.
- [ ] **Re-crawl the site after deployment** to confirm meta tags, canonical, and the already-coded Organization/WebSite JSON-LD now render live, and that `robots.txt`/`sitemap.xml` serve correctly.

## Phase 2: High-Impact Improvements (Weeks 2-3)

- [ ] **Add a `/deal/:id` permalink route and page** — title/H1, current price, strikethrough MRP, discount %, price-drop callout, source badge, rating, bank offers/coupon text, product image, and a "Get This Deal" CTA hitting the existing click endpoint. Backend data already exists via `GET /v1/deals/:id` and `GET /v1/products/:id`. Handle expired deals gracefully (show "This deal has expired" + similar current deals) rather than 404ing, to preserve any accumulated link value.
- [ ] **Link every `DealCard` title to its new permalink page** (`<Link to={`/deal/${deal._id}`}>`) in addition to the existing buy button.
- [ ] **Add `Product` + `Offer` JSON-LD to each new deal page**; add `BreadcrumbList` to category pages; add `ItemList` to listing pages (`/`, `/trending`, `/category/:name`, `/price-drops`). Ready-to-use JSON-LD examples are in `findings/schema.md`.
- [ ] **Add standard security headers** via nginx `add_header`: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, plus a `Content-Security-Policy` scoped to real script/style/API origins.
- [ ] **Enable gzip/brotli compression in nginx** for `application/javascript`, `text/javascript`, and `text/css` — the current largest JS chunk (928KB) is served completely uncompressed.
- [ ] **Remove `loading="lazy"` from the first above-the-fold product card image** — use `loading="eager"` + `fetchpriority="high"` instead; keep lazy-loading for cards further down the grid.
- [ ] **Generate a real `sitemap.xml`** covering static routes plus per-deal URLs once they exist. Recommend generating it server-side in `apps/api` (e.g. `GET /v1/sitemap.xml`) so `lastmod` reflects real deal update times, since content rotates every ~10 minutes via the poller cron.

## Phase 3: Content & Authority (Month 2)

- [ ] **Add a short category-specific intro** (100-200 words) to each of the 8 category pages — what appears there, update cadence, curation criteria.
- [ ] **Add one original sentence of curation commentary per deal**, using existing `previous_price`/`price_drop_percent` data, rather than relying solely on the scraped marketplace title.
- [ ] **Surface the existing `feed/compare` price-comparison data as static on-page content** with `AggregateOffer` schema instead of a client-only modal.
- [ ] **Add `llms.txt`** and explicit AI-crawler allow rules (`GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`) to `robots.txt`, plus a `Sitemap:` directive.
- [ ] **Register free Moz and Bing Webmaster Tools accounts** for better backlink/indexation visibility in future audits; submit to relevant deal/coupon directories (DesiDime, FreeKaaMaal, IndianDealsForum) and cross-promote with the source Telegram channels' own websites/blogs.

## Phase 4: Monitoring & Iteration (Ongoing)

- [ ] Re-run Lighthouse/PageSpeed Insights after the production deploy to confirm LCP ≤ 2.5s; pull CrUX field data once traffic accumulates.
- [ ] Re-run this SEO audit after Phase 1-2 ship to confirm the health-score improvement and catch regressions.
- [ ] Once Search Console access exists, monitor indexation status of the new `/deal/:id` pages.
- [ ] Re-run the backlink audit in 60-90 days once outreach begins (Common Crawl data updates quarterly).

---

## Dependency Notes

- Nearly everything in Phase 2-4 that touches meta tags, canonical URLs, or JSON-LD depends on Phase 1's deployment fix landing first — the code for most of it already exists in the repo and simply isn't shipped.
- The `/deal/:id` permalink page (Phase 2) is the single most-cited cross-cutting recommendation across the technical, content, schema, e-commerce, SXO, and GEO findings — it unblocks Product/Offer schema, AI citation, internal linking, and the two highest-intent user personas identified in the SXO audit.
