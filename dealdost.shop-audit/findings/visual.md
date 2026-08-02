# Visual / UX Audit — dealdost.shop

Screenshots saved to `dealdost.shop-audit/screenshots/`:
- homepage_desktop.png / homepage_desktop_full.png
- homepage_mobile.png / homepage_mobile_full.png
- trending_desktop.png / trending_desktop_full.png
- trending_mobile.png / trending_mobile_full.png

## Critical

**1. Production is serving the raw Vite dev server, not a built bundle.**
`curl -s https://dealdost.shop/` returns dev-mode HTML: `<script type="module" src="/@vite/client">`, React Refresh boilerplate (`injectIntoGlobalHook`), and an unbundled `<script type="module" src="/src/main.tsx">` entry point — not hashed production `/assets/*.js` bundles. This explains the earlier `DOMContentLoaded timed out after 15000ms` failure: the dev server transforms hundreds of unbundled ES modules per request with no production caching/minification. Playwright only succeeded here with a 45s load timeout + 20s networkidle grace period — far beyond normal crawl-budget/user-patience thresholds.
**Recommendation:** deploy actual `vite build` output via a static host/CDN, not `vite dev`/`vite preview`.

**2. Zero content in raw HTML — no SSR/prerendering.**
Raw response body is just `<div id="root"></div>` — no `<meta name="description">`, no visible text. All content (nav, hero, deal cards) is injected client-side. Any crawler/tool that doesn't fully execute JS, or times out before hydration (per #1), sees a blank page with no deal content indexed at all. Compounds with #1: slow dev-server response + CSR-only = high risk of bots seeing nothing.

## Medium

**3. Category nav row scrolls horizontally with zero visual affordance (mobile).**
DOM measurement: the category chip row has `scrollWidth: 1071px` vs `clientWidth: 375px` on a 375px viewport (class `hide-scrollbar` explicitly suppresses the scrollbar). ~2/3 of categories (Electronics, Kitchen, Fashion, Beauty, Books, Grocery, Sports, Home) are off-screen with no fade/arrow cue — screenshot shows the row cut off mid-word ("Elect...") at the edge. Users likely don't discover most category filters exist.

**4. Touch targets below recommended minimum (mobile).**
Measured: category nav chips ~28px height, search icon 22x24, "Compare prices" link 138x30, "Login" 68x34, "Get This Deal" 138x44 (borderline). WCAG/Google guidance recommends ≥44-48px. Increases mis-tap risk on the CTA-driven affiliate flow.

## What works

**5. Above-the-fold content is strong once rendered** — hero value-prop + CTA followed immediately by real "Latest Deals" cards with pricing/discount/CTA, visible without scrolling on desktop (4 cards) and hero+first card on mobile. `/trending` is even better — straight into a full 8-card grid, no filler.

**6. Consistent visual polish** across desktop/mobile/both routes — no overlapping elements, no broken layout, no page-level horizontal scroll (confirmed `document.documentElement.scrollWidth === window.innerWidth`; the only horizontal overflow is the isolated, intentional-but-undiscoverable category chip row in #3).

## Bottom line

The actual rendered UI is well-designed and content-forward — the real risk is entirely upstream of the UI itself: production is running a dev server with no SSR, so the good UI may frequently fail to render for crawlers/bots/slow connections, matching the failure already observed pre-audit. Fixing #1/#2 should be top priority; #3/#4 are worthwhile mobile polish once rendering is stable.
