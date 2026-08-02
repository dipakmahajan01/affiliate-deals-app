# Sitemap & Robots.txt Audit — dealdost.shop

## Summary

`robots.txt` and `sitemap.xml` both return **HTTP 200** but serve the SPA's `index.html` shell instead of their real content, so neither is functional. Root cause identified: **the production deployment is not a static build** — it is a `vite dev` server (unbundled `/src/main.tsx`, `/@vite/client`, `/@react-refresh` all present in every response) with nginx/whatever sits in front returning the SPA shell for **every** path, including files that genuinely exist in `apps/web/public/` (`robots.txt`, `sitemap.xml`, `favicon.svg`, `icon-192.png` all come back as `text/html`). This is broader than an SEO-file gap — it means no static asset in `public/` is reachable in production today.

## Validation Evidence

```
$ curl -sI https://dealdost.shop/robots.txt
HTTP/1.1 200 OK
Content-Type: text/html          # should be text/plain
Server: nginx/1.28.3 (Ubuntu)

$ curl -s https://dealdost.shop/robots.txt | head -5
<!doctype html>
<html lang="en">
  <head>
    <script type="module">import { injectIntoGlobalHook } from "/@react-refresh";
...

$ curl -s https://dealdost.shop/sitemap.xml | head -5
<!doctype html>                   # same SPA shell, not the sitemap
...

$ curl -sI https://dealdost.shop/icon-192.png
HTTP/1.1 200 OK
Content-Type: text/html           # should be image/png — proves it's not sitemap-specific
```

Automated sitemap discovery (`sitemap_discovery.py`) confirms every common sitemap path (`/sitemap.xml`, `/sitemap_index.xml`, `/sitemap-index.xml`, `/wp-sitemap.xml`) returns 200 with invalid XML (`DOCTYPE is not allowed in sitemap XML`) — i.e. the SPA shell.

## Findings (severity-tagged)

| # | Finding | Severity | Check |
|---|---|---|---|
| 1 | Production origin serves `vite dev` (unminified, `/src/main.tsx`, `/@react-refresh`, `Cache-Control: no-cache`) instead of a `vite build` output — no static build artifact is being deployed. | **Critical** | Root cause |
| 2 | Every path, including files that physically exist in `apps/web/public/` (`robots.txt`, `sitemap.xml`, `favicon.svg`, `icon-192.png`), returns the SPA `index.html` with `Content-Type: text/html`. There is no web-server rule serving static/public assets before the SPA catch-all. | **Critical** | Invalid content-type / non-functional robots & sitemap |
| 3 | `robots.txt` is unreachable in its real form, so no crawler directives are being honored today (a crawler that requests it just gets a 200 HTML page with no `User-agent` rules). | **Critical** | Invalid robots.txt |
| 4 | `sitemap.xml` is unreachable in its real form → zero content discovery signal for Google/Bing today. | **Critical** | Invalid XML / >0 issue |
| 5 | The repo **already contains** a reasonable `robots.txt` and `sitemap.xml` in `apps/web/public/` (see below) — they are correctly written but simply never reach a crawler because of finding #1/#2. This is a deployment/infra bug, not a missing-content bug. | High | N/A — context |
| 6 | Existing repo `sitemap.xml` uses `<priority>` and `<changefreq>` tags, both ignored by Google (Bing/others give them minimal weight). Harmless but dead weight. | Info | priority/changefreq |
| 7 | Existing repo `sitemap.xml` has **no `<lastmod>`** on any URL. Category pages and `/trending`/`/price-drops` are highly dynamic (deals rotate every ~10 min via the poller cron) — real `lastmod` values would help crawl scheduling. | Low | lastmod accuracy |
| 8 | Existing repo `sitemap.xml` includes `/assistant`. This is a JS-driven chat tool with no listing/product content on load — not a content page and should not compete for crawl budget in the sitemap (it can still be `index`able via robots meta, just not in the sitemap). | Medium | Extra/low-value page in sitemap |
| 9 | Existing repo `sitemap.xml` is **missing** `/digest` — correctly, since `DigestDeals.tsx` renders `<Seo path="/digest" noindex />` for query-param-driven personalized email links. Confirmed intentional, no action needed. | Info | N/A — correct exclusion |
| 10 | Existing repo `robots.txt` disallows `/digest` and `/search` — both pages already self-tag `noindex, nofollow` via `react-helmet-async` (client-rendered). Consistent, but see finding #11. | Info | N/A — correct exclusion |
| 11 | `noindex` directives for `/login`, `/signup`, `/search`, `/digest` are injected **client-side only** via `react-helmet-async` (`<Helmet>`). Because of finding #1/#2, the raw HTML crawlers first see has **no meta tags at all** (no title, no description, no canonical, no robots meta) until JS executes. Googlebot does render JS in a second wave, but Bing and other engines are less reliable at this, and the current robots.txt `Disallow` lines are the only server-independent signal — which is good, but reinforces that robots.txt/sitemap must actually be served as static files, not depend on the SPA rendering path at all. | High | Related to JS crawlability |
| 12 | No per-deal/product permalink URLs exist in the app (deals are cards inside `/`, `/category/:name`, `/trending`, `/price-drops` — no `/deal/:id` route). This caps sitemap usefulness: the sitemap can only point crawlers at list/category pages, never at an individual deal, so individual products can never rank or be shared as a canonical indexable URL. | Medium (forward-looking) | Coverage gap |
| 13 | No `Sitemap:` reference issue — existing `robots.txt` already correctly declares `Sitemap: https://dealdost.shop/sitemap.xml`. | Info | Pass |
| 14 | URL count / file size: 12 URLs, well under the 50,000 URL / 50MB limit. No splitting needed at current or near-term scale. | Info | Pass |
| 15 | No `/admin` or API paths (`/v1/*`) are referenced in either file — correctly, since `apps/admin` and `apps/api` are separate apps/ports and shouldn't be crawlable from the public site's robots.txt. Recommend adding an explicit `Disallow: /admin` line anyway as defense-in-depth in case admin is ever reverse-proxied under the same origin/domain. | Low | Defensive hardening |

## Location-Page Quality Gate Check

Category pages (`/category/:name`) are the closest analogue to "location pages" here. Current count: **8** (Electronics, Kitchen, Fashion, Beauty, Books, Grocery, Sports, Home) — well under the 30-page warning threshold. No quality-gate action needed. If category count grows toward 30+, apply the 60%+ unique-content-per-page bar (each category page's uniqueness currently comes from live query results, which is dynamic/legitimate, not templated boilerplate — low doorway-page risk).

## Recommended `robots.txt`

Place at `apps/web/public/robots.txt` (already present — content below is a refinement) **and fix the serving bug (see Root Cause Fix)**:

```
User-agent: *
Allow: /
Disallow: /login
Disallow: /signup
Disallow: /digest
Disallow: /search
Disallow: /admin
Disallow: /v1/

Sitemap: https://dealdost.shop/sitemap.xml
```

Changes vs current file: added `Disallow: /admin` and `Disallow: /v1/` as defense-in-depth (harmless even if those aren't on this origin). Kept `/digest` and `/search` disallowed since both are confirmed non-canonical/personalized/query-driven pages that already self-noindex. `/assistant` is intentionally **not** disallowed here (it's a legitimate, indexable tool page) — it's just excluded from the sitemap listing below.

## Recommended `sitemap.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://dealdost.shop/</loc>
    <lastmod>2026-08-03</lastmod>
  </url>
  <url>
    <loc>https://dealdost.shop/trending</loc>
    <lastmod>2026-08-03</lastmod>
  </url>
  <url>
    <loc>https://dealdost.shop/price-drops</loc>
    <lastmod>2026-08-03</lastmod>
  </url>
  <url>
    <loc>https://dealdost.shop/category/Electronics</loc>
    <lastmod>2026-08-03</lastmod>
  </url>
  <url>
    <loc>https://dealdost.shop/category/Kitchen</loc>
    <lastmod>2026-08-03</lastmod>
  </url>
  <url>
    <loc>https://dealdost.shop/category/Fashion</loc>
    <lastmod>2026-08-03</lastmod>
  </url>
  <url>
    <loc>https://dealdost.shop/category/Beauty</loc>
    <lastmod>2026-08-03</lastmod>
  </url>
  <url>
    <loc>https://dealdost.shop/category/Books</loc>
    <lastmod>2026-08-03</lastmod>
  </url>
  <url>
    <loc>https://dealdost.shop/category/Grocery</loc>
    <lastmod>2026-08-03</lastmod>
  </url>
  <url>
    <loc>https://dealdost.shop/category/Sports</loc>
    <lastmod>2026-08-03</lastmod>
  </url>
  <url>
    <loc>https://dealdost.shop/category/Home</loc>
    <lastmod>2026-08-03</lastmod>
  </url>
</urlset>
```

Changes vs current file: dropped `<priority>`/`<changefreq>` (ignored by Google, dead weight), dropped `/assistant` (not a content/listing page), and added `<lastmod>`. Note: for `lastmod` to be genuinely useful (not just today's date on every deploy), it should be generated server-side and reflect the actual latest `deals` document `updatedAt` per category — see Root Cause Fix below for why this needs to move server-side anyway.

## Root Cause Fix (blocking — required before any sitemap/robots content matters)

1. **Deploy a production build, not `vite dev`.** `apps/web` must be built with `vite build` (outputs to `apps/web/dist/`) and served as static files — `vite dev` should never run in production (confirmed via `/@react-refresh`, `/@vite/client`, unbundled `/src/main.tsx`, and `Cache-Control: no-cache` on every response).
2. **Fix the web-server routing so static files take precedence over the SPA fallback.** Whatever serves `apps/web/dist/` (nginx `try_files`, or a Node static server) must serve real files (`robots.txt`, `sitemap.xml`, icons, manifest) directly and only fall back to `index.html` for routes that don't match a static file. Example nginx pattern:
   ```nginx
   location / {
     try_files $uri $uri/ /index.html;
   }
   ```
3. **Recommended stronger fix — generate `sitemap.xml` server-side in `apps/api`.** Since category pages and `/trending`/`/price-drops` content changes every ~10 minutes (poller cron), a static `sitemap.xml` in `apps/web/public/` will always have stale/fake `lastmod` values. Adding a route like `GET /v1/sitemap.xml` in `apps/api` (querying `MAX(deals.updatedAt)` per category for real `lastmod`, or per-deal if permalinks are added later per Finding #12) and reverse-proxying `dealdost.shop/sitemap.xml` → that API route would be more accurate and wouldn't require a rebuild every time category content changes. `robots.txt` can remain a static file since its content is stable.

## Forward-Looking Recommendation (non-blocking)

Add per-deal permalink pages (e.g. `/deal/:id` or `/deal/:slug`) with a dedicated `<Seo>` block, product schema (coordinate with the schema-markup audit), and a canonical URL. Until these exist, the sitemap is structurally capped at 11 list/category URLs — no individual deal can ever be an indexable, shareable, rankable page. This doesn't block shipping the fixes above, but should be scoped as a near-term follow-up since it's the single highest-leverage SEO improvement available to this app (more indexable pages = more long-tail search entry points for specific products).
