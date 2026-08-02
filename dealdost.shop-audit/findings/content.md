# Content Quality Audit — dealdost.shop

Scope: E-E-A-T, FTC disclosure, thin/duplicate content risk, readability, content depth, AI citation readiness.
Method: `render_page.py` (Playwright, full JS render) against `/`, `/trending`, `/category/electronics`, cross-checked against source in `apps/web/src`.

---

## CRITICAL-1 — No individual deal/product pages exist (top structural finding)

Deals only ever appear as `<DealCard>` components inside listing pages (`/`, `/trending`, `/category/:name`, `/price-drops`). There is no route that resolves to a single deal (confirmed against `apps/web/src/App.tsx:20-28` — only `/`, `/category/:name`, `/digest`, `/search`, `/trending`, `/price-drops`, `/assistant`, `/login`, `/signup` exist). `DealCard.tsx` fires the buy action via an `onClick` handler (`handleDealClick`), not an `<a href>`, so there isn't even an anchor to expose.

**Impact:**
- No deal ever gets a unique URL, `<title>`, meta description, or canonical — the fundamental unit of "content" on an affiliate site is invisible to search and AI crawlers.
- Nothing is indexable, linkable, or shareable per-deal. Every inbound link, citation, or bookmark can only point at a listing page whose contents change within hours (deals rotate/expire).
- This is the root cause of nearly every other finding below (no product schema, no AI-citable URL, no way to accrue topical authority per product/category over time).

**Recommendation:** Introduce a permalink per deal, e.g. `/deal/:slug-or-id`, server-rendered or pre-rendered with the deal's title, price, image, source badge, and a stable canonical URL. Even a thin dedicated page (title + description + Product/Offer JSON-LD + image + "Get this deal" CTA) is dramatically better than the current zero.

---

## CRITICAL-2 — SEO metadata code exists but does not reach the live page (site-wide)

`apps/web/src/components/Seo.tsx` (via `react-helmet-async`) is properly wired into `Home.tsx` and `Category.tsx`, and is designed to inject route-specific `<title>`, `<meta name="description">`, `<link rel="canonical">`, Open Graph/Twitter tags, and JSON-LD (`Organization` + `WebSite` on the homepage).

None of this appears on the live site. Full-render checks (Playwright, 15-16s render budget, JS fully executed) on three different routes all returned the **exact same static head**:

```html
<meta charset="UTF-8">
<link rel="icon" type="image/png" href="/icon-192.png">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#f97316">
<title>DealDost � Best Amazon &amp; Flipkart Deals from Telegram</title>
```

- `/` → same title as `/category/electronics`, which should read "Best electronics Deals Today | DealDost" per `Category.tsx:16`. It doesn't.
- Zero `<meta name="description">` anywhere.
- Zero `<link rel="canonical">` anywhere.
- Zero JSON-LD anywhere, despite `Home.tsx` explicitly emitting `Organization` and `WebSite` schema blocks.
- The `<title>` itself has a mojibake artifact (`�` where an em dash should be), suggesting the served HTML isn't even the intended UTF-8 output.

Combined with the response markup containing `<script type="module">import { injectIntoGlobalHook } from "/@react-refresh"...` and `<script type="module" src="/@vite/client">` — these are Vite **dev-server-only** injections that should never appear in a production build — the live site looks like it's being served from `vite dev` (or a stale/dev artifact) rather than a production `vite build` output. That would explain why Helmet's client-side head mutations aren't showing up consistently and why every route shares the same head snapshot.

**Impact:** All the on-page SEO/AI-citation work already written in the codebase (titles, descriptions, canonicals, structured data) is currently worth zero to any crawler. This is likely the single highest-leverage fix available — the content team already did the work; it just isn't shipped.

**Recommendation:** This overlaps with technical/infra — flag jointly with the technical audit. Confirm what's actually deployed at dealdost.shop (production build vs dev server), redeploy a real `vite build` output behind the web server, and re-verify Helmet output renders per-route after the fix.

---

## CRITICAL-3 — No FTC affiliate disclosure anywhere on the site

Searched full rendered HTML and body text of the homepage for any of: "disclosure", "affiliate" (as a disclosure term), "About", "Contact", "Privacy", "Terms", "FTC", "commission", "sponsor" — **zero matches on all terms**. No `<footer>` element exists in the rendered DOM at all (`footer` tag count: 0), and the site's route table (`App.tsx`) has no `/about`, `/disclosure`, `/privacy`, `/terms`, or `/contact` route — these pages simply don't exist in the codebase, they weren't just missed on this crawl.

**Impact:** DealDost is an Amazon Associates / Flipkart affiliate site that monetizes exclusively through affiliate commissions (per `apps/api/src/services/affiliate.ts` and the CLAUDE.md architecture notes) with zero disclosure of that relationship anywhere a user or crawler can see. This is:
- An FTC Endorsement Guide violation (US) if any US traffic/marketing is involved — affiliate relationships must be "clear and conspicuous," not something users have to infer.
- A major Trustworthiness (the highest-weighted E-E-A-T factor per Google's QRG) gap: no author, no editorial entity, no operator identity, no contact channel, no privacy/terms — a rater would be unable to answer "who is behind this site" at all.

**Recommendation:** Add a footer present on every page with: affiliate disclosure statement ("As an Amazon Associate/Flipkart Affiliate we earn from qualifying purchases"), About/who-runs-this-site blurb, Privacy Policy, Terms, and a real contact method (email/form). This is a compliance issue, not just an SEO nice-to-have — treat as highest priority alongside CRITICAL-2.

---

## HIGH-1 — Category and listing pages have near-zero unique textual content

Rendered `extracted_text` for `/category/electronics` (after a full JS render) was:

> "Deal Dost 🔍 Login Sign Up 🧞 Ask AI 🔥 Trending 📉 Price Drops [category icons] electronics Deals 🧞"

That's the entire unique content on the page outside of global nav — a single-line, un-capitalized heading ("electronics Deals") with no supporting copy: no explanation of what the category covers, no buying guidance, no curation rationale, nothing distinguishing it from any other category page except the interpolated `{name}` string. This is templated boilerplate, not content, and sits far below the 500-600 word floor this skill uses for comparable listing/location-style pages — though the deeper issue is topical coverage, not the word count itself.

Note: the category product grid did not finish loading within the ~16s Playwright render budget in this test (see MEDIUM-1) — but even accounting for that, the static/template portion of the page (the part guaranteed to be present regardless of load timing) carries no original content.

**Recommendation:** Add a short (100-200 word) category intro above the fold — what kinds of deals appear here, how often it updates, any curation criteria — written once per category, not templated. This also gives Helmet something meaningfully different to put in the meta description per category once CRITICAL-2 is fixed.

---

## HIGH-2 — Deal "content" is verbatim marketplace copy, not original text

`apps/api/src/services/parser.ts` derives `product_title` directly from the first line of the raw Telegram message (essentially the marketplace listing title as posted by the channel), with no rewriting, summarization, or added commentary. `DealCard.tsx` then renders exactly that string as the only descriptive text per deal — no pros/cons, no "why this is a good deal," no first-hand testing or usage notes, no comparison context beyond a bare price/discount number.

Example titles observed on `/trending`:
> "Vega Voyager Full Face Riding Helmet with Lightweight Shell, Comfortable Liner, Shock Absorbing Interior, Ventilated Design, Aerodynamic Build, and Modern Anthracite Styling Anthracite-M"

This is a manufacturer/listing title, not editorial content — it reads as keyword-stuffed marketing copy because it *is* the marketplace's own SEO title, republished as-is.

**Impact under Sept 2025 QRG:** classic low-effort aggregation pattern — no Experience signal (nobody used/tested the product), no Expertise signal (no independent judgment applied), content is identical to what appears on the source marketplace and on every other Telegram deal channel republishing the same message. Combined with CRITICAL-1 (no stable per-deal URL), this content can't accrue any independent authority even if it were unique.

**Recommendation:** At minimum, add one original sentence per deal at ingestion/curation time (e.g., a short "why we're featuring this" note, category fit, or price-history context using the `previous_price`/`price_drop_percent` data already captured) rather than relying solely on the scraped title as the entire content payload.

---

## HIGH-3 — Zero structured data live; no Product/Offer schema even in source

Even setting aside CRITICAL-2 (nothing renders live), the JSON-LD authored in `Home.tsx` only covers `Organization` and `WebSite` — there is no `Product`/`Offer`/`AggregateOffer` schema anywhere in the codebase for individual deals, and no `ItemList` schema for listing pages. Given CRITICAL-1 (no per-deal URL to anchor a `Product` entity to), this is a structural gap, not just a missing-tag issue.

**Recommendation:** Once per-deal pages exist (CRITICAL-1), add `Product` + `Offer` JSON-LD per deal (price, currency, availability, image, `priceValidUntil` if known) and `ItemList` schema on category/trending/price-drops pages referencing the per-deal URLs.

---

## MEDIUM-1 — Inconsistent/slow client-side hydration blocks crawler visibility

`/trending` fully rendered its product list within the Playwright budget; `/category/electronics` did not — after ~16s the page showed only nav + the one-line heading, no deal cards. Both routes hit the same `is_spa: true` client-fetch pattern, so this looks like route-to-route inconsistency in fetch/render timing rather than a deliberate difference. Google's renderer is patient but not infinite, and most non-Google AI/search crawlers (including many that power LLM citations) either don't execute JS at all or use much shorter render budgets — for them, `/category/electronics` (and likely other category routes) currently reads as an empty shell.

**Recommendation:** Investigate why category fetches are slower/less reliable than trending (API latency, waterfall of category-name → fetch, etc.), and prioritize SSR or static pre-rendering for listing pages regardless — this affects indexability independent of the metadata issues above.

---

## MEDIUM-2 — Duplicate content risk from unmodified marketplace titles

Because `product_title` is copied verbatim from the source Telegram post (itself usually copied from the Amazon/Flipkart listing), and countless other deal-aggregator sites/Telegram channels republish the same feeds, the exact same title strings are very likely to appear across many other domains. Without CRITICAL-1's per-deal URLs this can't be fixed with canonicalization — there's no page to canonicalize — but it compounds HIGH-2: this is text with no independent value that also isn't unique to dealdost.shop.

**Recommendation:** Covered by the HIGH-2 fix (original commentary per deal) plus CRITICAL-1 (stable URLs) — treat these three findings as one connected fix, not separate backlog items.

---

## AI Citation Readiness — currently near 0/100

An LLM cannot cite a specific DealDost deal today:
- No stable, unique URL per deal (CRITICAL-1) — nothing to link to.
- No live meta description/title per page to summarize (CRITICAL-2).
- No structured Product/Offer data to extract price/availability facts from (HIGH-3).
- Page text that does exist is either global nav boilerplate or a raw marketplace title with no surrounding editorial context to quote.
- No author/organization trust signals to establish source credibility (CRITICAL-3).

Fixing CRITICAL-1 through CRITICAL-3 is the prerequisite for any AI citation readiness work — there is no incremental improvement possible (e.g., "better meta descriptions") until deals have addressable pages.

---

## Readability

Not meaningfully assessable in the traditional sense (Flesch-Kincaid etc. apply to prose) — the only non-boilerplate text on the site is single-line product titles and short UI labels. This itself is the finding: there is no prose content on the site to evaluate for readability, which is a content-depth problem (HIGH-1, HIGH-2), not a writing-quality one.

---

## Priority Summary

| Priority | Finding |
|---|---|
| Critical | No per-deal permalink pages exist at all |
| Critical | SEO metadata (title/description/canonical/JSON-LD) is coded but not live on any route — verify production deployment |
| Critical | No FTC affiliate disclosure, About, Privacy, Terms, or Contact anywhere on the site |
| High | Category pages carry no unique content beyond a templated one-line heading |
| High | Deal "content" is verbatim marketplace titles with no original commentary |
| High | No Product/Offer/ItemList schema exists even in source, blocked on missing per-deal URLs |
| Medium | Category page product grid didn't render within Playwright's render budget (inconsistent vs. /trending) |
| Medium | Duplicate content risk from unmodified, widely-republished marketplace titles |
