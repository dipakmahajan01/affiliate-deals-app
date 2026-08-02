# Performance / Core Web Vitals Audit — dealdost.shop

Date: 2026-08-02/03 | Tool: Lighthouse 12.8.2 (local CLI, mobile, simulated throttling). PageSpeed Insights API was rate-limited for the duration of this audit (shared quota with other running audits), so results below are first-party Lighthouse lab runs plus manual curl header checks. CrUX field data unavailable (no API key configured / possibly insufficient traffic).

## Executive summary

Root cause confirmed: production is serving the raw Vite dev server, not a `vite build` bundle. This single issue is responsible for nearly all of the performance failures below. LCP is 16.1s (home) and 17.2s (trending), roughly 6.5x worse than the "poor" threshold (4.0s). TBT and CLS are fine, which is itself evidence the problem is almost entirely resource-loading/bundling, not runtime JS execution or layout instability.

## Core Web Vitals — lab results (mobile, simulated throttling)

| Metric | Home (/) | Trending (/trending) | Threshold (Good) | Status |
|---|---|---|---|---|
| LCP | 16.1 s (16,128 ms) | 17.2 s (17,168 ms) | <=2.5 s | Poor (~6.5x over) |
| TBT (lab proxy for INP) | 120 ms | 130 ms | <=200 ms | Good |
| CLS | 0 | 0 | <=0.1 | Good |
| FCP | 9.0 s | 9.3 s | <=1.8 s | Poor |
| Speed Index | 12.8 s | 12.9 s | <=3.4 s | Poor |
| Time to Interactive | 18.7 s | 19.4 s | -- | Poor |
| Lighthouse Performance score | 54/100 | 54/100 | -- | Needs improvement |

Note: this matches the earlier Playwright observation of DOMContentLoaded timing out after 15000ms — the homepage render in this audit own render tool took 15.4 s to reach a stable state, consistent with the LCP/TTI numbers above.

## Findings (severity-tagged)

### CRITICAL — Production is running vite dev, not a production build
Evidence:
- Response HTML for https://dealdost.shop/ includes dev-only HMR bootstrap:
  `<script type="module">import { injectIntoGlobalHook } from "/@react-refresh"; ...</script>`
  `<script type="module" src="/@vite/client"></script>`
- /src/main.tsx, /src/App.tsx, /src/pages/Home.tsx, /src/pages/Trending.tsx, /src/components/Navbar.tsx, etc. are served directly as unbundled ES module source (HTTP 200), exposing the app file/folder structure.
- Server header even leaks the deploy path: one dependency is served from
  /@fs/home/ubuntu/affiliate-deals-app/node_modules/.pnpm/vite@5.4.21_.../vite/dist/client/env.mjs
- Lighthouse network panel recorded 57 requests / 3.24 MB transferred on / and 59 requests / 3.45 MB on /trending — for a page whose actual visible content ("Latest Deals" grid + nav) should be a fraction of that in a production build. 40 of those 57 requests are JS/module files.
- 24 separate critical-request chains were recorded (critical-request-chains audit) — the browser has to serially resolve index.html -> /@vite/client -> env.mjs, index.html -> /src/main.tsx -> react_jsx-dev-runtime.js -> chunk-ULGNQERY.js / chunk-MYUJR7WL.js -> ... etc., each hop a round trip, before the app can even start rendering.
- The single largest asset, chunk-R6VWKJD2.js (a pre-bundled dev dependency chunk, unminified), is 928 KB by itself.
- Lighthouse unminified-javascript audit: 927 KiB of estimated savings. unused-javascript: 707 KiB estimated savings. Both are hallmarks of unbundled/unminified dev-mode JS, not a production build with tree-shaking + minification.

Why this is the #1 fix: the LCP breakdown for /trending shows 90% of the 17.2s LCP time is "Load Delay" — i.e. the browser spends nearly all of that time resolving the chain of unbundled JS module requests before it even discovers/starts fetching the LCP image. A code-split, minified, tree-shaken production bundle collapses this 24-hop chain into a handful of hashed, cacheable chunks and will very likely cut LCP by 10+ seconds on its own.

Recommendation: Run `pnpm --filter @deals/web build` (and `pnpm --filter @deals/admin build` if admin is also affected) to produce the dist/ output, and serve that static bundle via nginx (or behind the reverse proxy) instead of pointing traffic at the Vite dev server process. This is a deployment/ops config fix, not a code fix — check the process manager (pm2/systemd/docker) entry currently running vite/vite dev for apps/web in production and replace it with a proper static file server for the build output, using nginx with the SPA fallback (try_files $uri /index.html;) already needed for react-router-dom.

### HIGH — Static JS assets served without compression
Evidence: curl with Accept-Encoding gzip,br against the 928 KB chunk-R6VWKJD2.js chunk returns HTTP 200 with no Content-Encoding header and Content-Length 928483 (served raw/uncompressed) even though the client advertised gzip/br support. By contrast, the HTML document itself is gzip-compressed (content-encoding: gzip on /). Lighthouse uses-text-compression audit independently estimated 1,706 KiB of savings site-wide.

Recommendation: Once switched to a production build, ensure nginx has gzip on / brotli on covering application/javascript, text/javascript, and text/css mime types for the static asset location block. A minified+gzipped/brotli chunk of that 928 KB file should shrink to roughly 200-300 KB.

### HIGH — LCP element is loading="lazy" despite being above-the-fold
Evidence: Lighthouse LCP element on /trending is the first product card image:
`<img src="https://m.media-amazon.com/images/I/51d6FE4UcgL._SL1500_.jpg" ... class="w-full h-48 object-contain p-4" loading="lazy">`
Native lazy-loading on an image that is the LCP candidate delays its fetch until the browser has finished layout, adding avoidable latency on top of the JS-chain delay described above.

Recommendation: In the product grid/card component, do not apply loading="lazy" to the first N cards rendered above the fold (or at minimum the very first card) — use loading="eager" plus fetchpriority="high" for it and keep loading="lazy" for cards further down the grid. This is a small, independent win once the dev-server issue is fixed, since the JS-chain delay currently dwarfs it.

### MEDIUM — TTFB is borderline (should be re-verified post-fix)
Evidence: server-response-time audit reports 230 ms for the root document TTFB on both routes — right at/above the "good" 200ms threshold. The LCP breakdown for /trending separately reported TTFB at 744 ms in the trace, likely reflecting cold-start/back-end latency variance rather than static-asset serving.

Recommendation: Not urgent relative to the dev-server fix, but worth re-checking after the production build is deployed — if the API (apps/api) is doing synchronous DB work on the page-data endpoints, consider response caching (the digest/poller docs suggest data changes at most every 10 min via the cron poller, so a short-TTL cache on feed endpoints would be safe and cheap).

### GOOD — CLS and TBT are not problems
CLS = 0 on both routes (no layout-shift issues to fix — dimensions/reservations for images and dynamic content appear handled correctly). TBT is 120-130ms, well under the 200ms "good" INP-proxy threshold, meaning main-thread JS execution itself is not heavy — reinforcing that the bottleneck is resource loading, not script execution time. Do not spend effort here; INP is very likely to be "Good" already for real users once LCP is fixed and pages become interactive sooner.

## Prioritized action plan

1. (Critical, do first) Deploy the actual vite build production output for apps/web instead of running the Vite dev server in production. Expect this alone to bring LCP from ~16-17s down to low single digits.
2. (High) Enable gzip/brotli compression in nginx for JS/CSS static assets — compounds with #1 once assets are minified+hashed.
3. (High) Remove loading="lazy" from the first above-the-fold product card image (LCP candidate); keep lazy-loading for the rest of the grid.
4. (Medium) Re-measure TTFB after #1 is live; add short-TTL caching on feed/product endpoints if TTFB is still >200ms at the 75th percentile.
5. (Verify) Re-run Lighthouse/PSI on both routes after the production build is deployed to confirm LCP <=2.5s, and pull CrUX field data once traffic accumulates to validate against real users.

## Raw data
- dealdost.shop-audit/lh-home-mobile.json — full Lighthouse report for /
- dealdost.shop-audit/lh-trending-mobile.json — full Lighthouse report for /trending
