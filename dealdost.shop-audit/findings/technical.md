# Technical SEO Audit — dealdost.shop

Audited: 2026-08-03 (data captured live via curl + Playwright render)
Site type: React + Vite SPA, client-side routed (react-router-dom), no SSR/prerendering, nginx 1.28.3 (Ubuntu) reverse proxy/static host.

## Technical Score: 22/100

The site is effectively unindexable in its current state — the root cause is that production is serving the Vite **development** server, not a built, static production bundle.

---

## Critical Issues

### 1. Production is running the Vite dev server, not a production build
**Status: FAIL**

`https://dealdost.shop/` returns raw dev-server HTML, not a built `dist/index.html`:

```html
<script type="module">import { injectIntoGlobalHook } from "/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;</script>
<script type="module" src="/@vite/client"></script>
...
<script type="module" src="/src/main.tsx"></script>
```

Verified directly:
- `GET /@vite/client` → `200 text/javascript` (dev-only HMR client, should not exist in prod)
- `GET /src/main.tsx` → `200 text/javascript` (unbundled, unminified TypeScript **source** served directly to the public internet)
- No `<script type="module" src="/assets/index-[hash].js">` bundle reference anywhere — confirms `vite build` was never run, or the built output isn't what's deployed.

**Impact:**
- Every page load triggers module-by-module unbundled ESM fetching (dozens of uncompiled `.tsx`/`.ts` requests) instead of one minified, chunked, hashed bundle — this is the direct cause of the extremely slow render observed (Playwright took **17.1s** to reach a stable DOM on `/`, and the requesting agent separately hit a `DOMContentLoaded` timeout at 15s). This blows every Core Web Vitals budget (LCP should be ≤2.5s) and risks Googlebot giving up mid-render, which for a JS-only SPA means **zero indexable content**.
- Full application source (component structure, API calls, internal logic) is exposed unminified to anyone via `/src/*`.
- No cache-busting hashed filenames, no tree-shaking, no minification — larger transfer size, worse cacheability (`Cache-Control: no-cache` is set site-wide, so nothing is cached at all, on top of everything being unbundled).
- Dev server is not hardened for public traffic (no production error boundaries, potential for dev-only endpoints/behaviors to be reachable).

**Recommendation:** Run `pnpm --filter @deals/web build` to produce `apps/web/dist/`, and serve that static output via nginx (or `vite preview` behind nginx, though a plain static file serve is preferred) instead of `vite`/`pnpm dev`. This alone will fix the stale/missing meta tags (issue #3 below), since the dev server appears to be running against an older checkout that predates the current `index.html`, `Seo.tsx`, and favicon assets in the repo.

### 2. No robots.txt or sitemap.xml exist — both are swallowed by the SPA catch-all
**Status: FAIL**

```
GET /robots.txt      → 200, Content-Type: text/html, body = full SPA index.html shell
GET /sitemap.xml     → 200, Content-Type: text/html, body = full SPA index.html shell
GET /sitemap_index.xml, /sitemap-index.xml, /wp-sitemap.xml → same (all 200, all the SPA shell)
```

Ran the sitemap discovery helper against the live site: `declared: []`, `found: []` — no valid sitemap reference exists anywhere, and every common sitemap path returns the SPA shell (`DOCTYPE is not allowed in sitemap XML` parse errors on every candidate).

There is no nginx routing rule that serves these as static files ahead of the SPA catch-all (or, more likely, there are no such static files in the deployed dev-server working directory at all).

**Impact:** Search engines have no crawl directives and no sitemap of the site's real routes. Combined with issue #4 (no product detail URLs), there is effectively nothing for Googlebot to discover beyond the 8 top-level app routes it stumbles onto via internal links — and even those aren't listed anywhere.

**Recommendation:**
1. Add a real static `apps/web/public/robots.txt` (served automatically once a production build + static host is in place) with an explicit sitemap reference.
2. Generate a real `sitemap.xml` listing the indexable routes (`/`, `/category/:name` for each known category, `/trending`, `/price-drops`, `/digest`, `/search` if it should be indexed). Since there's no SSR, this will need to be generated as a build step or a small server-rendered/static endpoint — a client-only route can't serve valid sitemap XML (as proven above, the catch-all always returns `text/html`).
3. Given there are no per-deal permalink URLs (issue #4), the sitemap's practical value is currently limited to the 6-8 static routes: fixing that gap will make the sitemap meaningfully more valuable.

### 3. No canonical tag, no meta description, on any route — index.html is missing SEO tags entirely (not just stale)
**Status: FAIL**

The live `<head>` on **every** route (verified `/`, `/category/electronics`, `/digest`, `/search`, `/trending`, `/price-drops`, `/assistant`, `/login`, `/signup`, and even a nonexistent path) is **byte-identical**:

```html
<head>
    <script type="module">...react-refresh...</script>
    <script type="module" src="/@vite/client"></script>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/icon-192.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f97316" />
    <title>DealDost — Best Amazon & Flipkart Deals from Telegram</title>
</head>
```

There is **no** `<meta name="description">`, **no** `<link rel="canonical">`, and **no** per-route title variation in the raw HTML — confirmed identical `Content-Length: 709` / identical `ETag` across all 9 routes tested. `apps/web/src/components/Seo.tsx` presumably updates these client-side via JS (e.g. `react-helmet`-style DOM mutation) after the SPA hydrates, but:
- Given the ~17s render time in issue #1, there's a real risk crawlers never execute the JS that sets these tags.
- Even for crawlers that do execute JS, client-injected canonical/meta tags are a known weak signal vs. server-rendered ones, and Google explicitly deprioritizes JS-injected `rel=canonical`.

Compare against the current repo source `apps/web/index.html`, which **does** have `<meta name="description">` and `<link rel="canonical" href="https://dealdost.shop/" />` hardcoded — confirming the deployed artifact is out of sync with the repo, consistent with issue #1 (dev server serving a stale checkout).

**Impact:** No indexable canonical signal (compounds the www/apex duplication in issue #5), no description for SERP snippets, identical `<title>` for every route in search results (poor CTR, self-competing pages).

**Recommendation:** Fix via issue #1 (deploy current build). Additionally, verify `Seo.tsx` sets a *static* canonical/description default in `index.html` itself (as the current repo does) as a fallback for the pre-hydration paint, and confirm each route (`/category/:name`, `/trending`, etc.) gets a distinct, route-specific canonical URL and title via `Seo.tsx`, not just the homepage default.

### 4. No indexable per-deal URLs — every product is trapped inside listing pages
**Status: FAIL (confirmed)**

Routes are limited to `/`, `/category/:name`, `/digest`, `/search`, `/trending`, `/price-drops`, `/assistant`, `/login`, `/signup`. There is no `/deal/:id` or `/product/:id` route — individual deals (e.g. "Vega Voyager Full Face Riding Helmet...", confirmed present in rendered homepage text) only exist as cards inside listing pages, with no unique, linkable, indexable URL.

**Impact:** No deal can ever rank individually in search (e.g. for its product name/model), no deal can be shared/linked directly, no way to build a sitemap of product pages, no structured data can be attached to a canonical product URL. This is a structural content gap, not just a technical one — flagging here since it caps the sitemap's usefulness (issue #2) and blocks Product structured data (issue #7).

**Recommendation:** Add a `/deal/:id` (or `/product/:id`) detail route with server-renderable-equivalent meta tags per deal (title = product name, description = price/discount, canonical = self) and include these in the sitemap.

---

## High Priority Issues

### 5. `www.dealdost.shop` serves duplicate content with no redirect and no canonical
**Status: FAIL**

```
GET https://www.dealdost.shop/ → 200 OK, byte-identical body/ETag to https://dealdost.shop/
```

No 301 redirect from `www` → apex (or vice versa). TLS cert does cover both (`SAN: dealdost.shop, www.dealdost.shop`), so there's no certificate blocker to fixing this at the nginx/DNS level. Since there's also no canonical tag at all (issue #3), search engines have zero signal for which host is authoritative — classic duplicate-content setup.

**Recommendation:** Pick apex (`dealdost.shop`, consistent with the repo's canonical URL) as canonical and add an nginx server block that 301-redirects `www.dealdost.shop` → `https://dealdost.shop` for all paths.

### 6. Missing all standard security headers
**Status: FAIL**

Full response header set (homepage, and confirmed same pattern site-wide):
```
Server: nginx/1.28.3 (Ubuntu)
Content-Type: text/html
Cache-Control: no-cache
Vary: Origin
Etag: ...
```

Absent entirely: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. No `X-Robots-Tag` either (not currently harmful since it means no unintended blocking, but worth setting deliberately once the build is fixed).

**Impact:** Not a direct ranking factor, but HSTS absence leaves a window for protocol-downgrade/SSL-stripping on repeat visits, and missing `X-Content-Type-Options: nosniff` / `X-Frame-Options` (or `frame-ancestors` in CSP) leaves the site open to MIME-sniffing and clickjacking. Security posture is increasingly used as a quality signal, and Lighthouse's "Best Practices" score (which does factor into some Search Console/PageSpeed-linked signals) will flag these.

**Recommendation:** Add via nginx `add_header`:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
```
Plus a `Content-Security-Policy` scoped to the app's actual script/style/API origins once the dev-server script injections (`/@vite/client`, inline `<script type="module">` HMR shim) are removed by fixing issue #1 — a CSP written against the current dev-mode markup would need `unsafe-inline`, which defeats its purpose.

### 7. No structured data (Schema.org) anywhere
**Status: FAIL**

Playwright-rendered DOM structured-data extraction returned `block_count: 0` on the homepage, despite visible product cards in the rendered text (helmet, ceiling fan, etc.). No `Product`, `Offer`, `ItemList`, `BreadcrumbList`, or `WebSite`/`SearchAction` JSON-LD present anywhere in raw or rendered HTML.

**Impact:** No eligibility for rich results (price/rating snippets, sitelinks search box, breadcrumb trails in SERPs) — significant missed visibility for a deals-listing site where price/discount rich snippets are a strong CTR driver.

**Recommendation:** Once per-deal URLs exist (issue #4), emit `Product`/`Offer` JSON-LD per deal card (and ideally on a per-deal detail page), `ItemList` on listing pages, and `BreadcrumbList` for `/category/:name`.

---

## Medium Priority Issues

### 8. Referenced favicon/manifest assets 404 to the SPA shell (soft-404)
**Status: FAIL**

```
GET /icon-192.png   → 200, Content-Type: text/html  (should be image/png; this is the SPA HTML shell, not an image)
GET /manifest.json  → 200, Content-Type: text/html  (should be application/json; PWA manifest is broken/missing)
```

The deployed `index.html` references `/icon-192.png` as its favicon, but that file doesn't exist on the server — nginx's catch-all is returning the SPA shell instead of a 404, and the browser silently fails to render a favicon. The current repo's `apps/web/index.html` instead references `/favicon.svg`, `/favicon-32.png`, and `/apple-touch-icon.png` — `/favicon.svg` **does** resolve correctly (200), confirming these assets exist in the current build output but the currently-deployed dev-server checkout predates them. Also confirms `manifest.json` (needed for the PWA install prompt mentioned in CLAUDE.md) is not being served — the "P" in PWA is currently non-functional in production.

**Recommendation:** Resolves automatically once issue #1 (deploy current build) is fixed. Separately, configure nginx to return a real `404` (not the SPA shell) for requests to `/*.png`, `/*.json`, `/*.ico` etc. that don't match an actual static file, so broken asset references are visible in logs/monitoring instead of silently masquerading as 200s.

### 9. Soft-404s: unknown paths return 200 with the homepage shell
**Status: FAIL**

`GET /nonexistent-page-xyz` → `200 OK`, body byte-identical to `/` (same `Content-Length: 709`, would presumably show a client-side "not found" state after JS runs, but the raw HTTP response is a bare 200). This is standard SPA catch-all behavior for client-side 404 handling, but without a `<meta name="robots" content="noindex">` injected for the not-found state (can't verify client-side behavior given issue #1's render delay), this risks Google indexing junk/mistyped URLs as if they were valid content, or at minimum wasting crawl budget.

**Recommendation:** Ensure the client router's not-found page sets `noindex` via `Seo.tsx` when no route matches, and verify this actually fires given the rendering performance issues above.

---

## Passed Checks

- **HTTPS enforced correctly**: `http://dealdost.shop/` → `301 Moved Permanently` → `https://dealdost.shop/`. TLS cert valid, covers both apex and `www`.
- **No mixed content**: no `http://` resource references found in the served shell (moot for a CSR app until issue #1 is fixed and real assets are inspectable, but no red flags currently).
- **Mobile viewport tag present and correct**: `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` present on all routes.
- **Content is eventually renderable by a JS-executing crawler**: Playwright *did* successfully extract real product text ("Vega Voyager Full Face Riding Helmet...", "Havells REO Vaayu 1200mm ES Ceiling Fan...", etc.) after full render — so this is not a pure JS-blocking/paywall situation, purely a performance/timeout risk (17.1s render time is the concern, not renderability itself).

---

## Priority Summary

| Priority | Issue | Fix effort |
|---|---|---|
| Critical | Deploy production build instead of Vite dev server (#1) | Low — deployment/infra config fix |
| Critical | Add real robots.txt + sitemap.xml (#2) | Low, blocked on #1 |
| Critical | Restore canonical/description meta tags (#3) | None — resolves via #1 |
| Critical | Add per-deal indexable URLs (#4) | Medium — new route + component |
| High | Redirect www → apex (#5) | Low — nginx config |
| High | Add security headers incl. HSTS/CSP (#6) | Low — nginx config, do after #1 |
| High | Add Product/Offer/ItemList structured data (#7) | Medium |
| Medium | Fix broken favicon/manifest 404s (#8) | None — resolves via #1 |
| Medium | noindex client-side 404 state (#9) | Low |

**Single highest-leverage fix:** resolving #1 (ship `vite build` output behind nginx instead of the dev server) directly fixes or unblocks #1, #3, #8, and materially de-risks #2's crawl-budget concerns and the render-timeout risk underlying nearly every other finding.
