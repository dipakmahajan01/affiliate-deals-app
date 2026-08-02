# Backlink Profile Audit — dealdost.shop

Audited: 2026-08-02/03. **Tier 0** analysis — no Moz or Bing Webmaster API keys configured (`backlinks_auth.py --check` confirms only Common Crawl + the local verification crawler are available). Findings below are domain-level only; no page-level anchor text, spam scoring, or referring-domain lists are available at this tier.

## Summary

**No backlink profile is currently detectable, and this is expected for a brand-new domain.** Common Crawl's web graph (release `cc-main-2026-jan-feb-mar`) has no record of `dealdost.shop` at all — the domain is absent from both the crawl and the ranking tables, meaning Common Crawl's most recent crawl cycle simply hasn't discovered/fetched it yet. No known-backlink list was supplied for this audit, so the verification crawler (which checks whether specific claimed backlinks still resolve) had nothing to check — there is no evidence of existing inbound links from any source available at this tier.

This is not a red flag. It is the default, near-universal state for a site this young (confirmed elsewhere in this audit as freshly deployed, still serving a dev build) with no deliberate outreach yet. Nothing here indicates a penalty, toxic link issue, or technical blocker — only that link acquisition hasn't started.

## Data Sources & Confidence

| Source | Status | Confidence | Notes |
|---|---|---|---|
| Common Crawl web graph | Queried, domain not found | 0.50 (domain-level only) | `commoncrawl_graph.py dealdost.shop` — see raw result below |
| Verification crawler | Not run | N/A | No candidate backlink URLs were provided or discoverable within this audit's tool access to check |
| Moz API | Unavailable | — | No `MOZ_API_KEY` configured (Tier 1 not reached) |
| Bing Webmaster API | Unavailable | — | No `BING_WEBMASTER_API_KEY` configured (Tier 2 not reached) |
| DataForSEO | Unavailable | — | Paid extension not installed (Tier 3 not reached) |

### Raw Common Crawl result

```json
{
  "domain": "dealdost.shop",
  "in_crawl": false,
  "in_rankings": false,
  "pagerank": null,
  "pagerank_rank": null,
  "harmonic_centrality": null,
  "harmonic_centrality_rank": null,
  "n_hosts": null,
  "note": "Domain not found in Common Crawl data. It may be too new, too small, or not yet crawled."
}
```

**Important interpretation note:** `in_crawl: false` means Common Crawl has not fetched this domain in its current crawl cycle — it does **not** mean "low authority" or "zero PageRank." Common Crawl's crawler prioritizes by discovered link popularity, so a domain with literally zero inbound links from anywhere it has already indexed will simply never be queued for a fetch. A brand-new domain with no backlinks yet is expected to be absent, independent of on-page quality. This will change automatically once any moderately-crawled site (a directory, a forum thread, a larger blog, etc.) links to `dealdost.shop` and that page gets recrawled.

## Findings (severity-tagged)

| # | Finding | Severity | Evidence |
|---|---|---|---|
| 1 | Zero referring domains detected across all available free sources (Common Crawl domain-level graph). | Info | CC query above; expected for a brand-new domain, not a defect |
| 2 | No known/candidate backlinks were available to run through the verification crawler — link-health monitoring (verify_backlinks.py) has nothing to track yet. | Info | No input data source |
| 3 | Cannot compute a numeric Backlink Health Score (0–100) — fewer than 4 of the 7 standard scoring factors (referring domains, domain quality distribution, anchor text, toxic link ratio, link velocity, follow/nofollow ratio, geographic relevance) have any data at Tier 0 with an empty profile. | Info | **INSUFFICIENT DATA** — reporting a score here would be misleading per scoring methodology |
| 4 | No toxic/spam link signals found — but this is because there is no link profile to evaluate, not because a clean profile was confirmed. Re-run this analysis once outreach begins. | Info | N/A |
| 5 | Domain is not registered with Bing Webmaster Tools or Moz, so no verified-property backlink data exists as a lower-cost alternative check. | Low | Tier gap, addressable for $0 (Moz free signup, Bing free verification) |

## Recommendations

The priority here is **link acquisition**, not link cleanup — there's nothing to clean up. Recommendations are ordered by effort-to-impact for a Telegram-sourced Amazon/Flipkart deals aggregator specifically.

### Immediate, low-effort (Info/quick wins)

1. **Register free authority tools now, before you need them.** Sign up for [Moz API](https://moz.com/products/api) (free tier, 2,500 rows/mo) and verify the domain in [Bing Webmaster Tools](https://www.bing.com/webmasters) (free). Neither costs money and both unlock materially better backlink visibility (DA/PA/spam score from Moz; Bing's own inbound-link index) for future audits — right now this audit is capped at Common Crawl's domain-level, quarterly-updated data.
2. **Submit to deal-aggregator and coupon directories.** These are the most natural, on-topic, low-effort first backlinks for a site in this niche: DesiDime, CashKaro-style deal forums, FreeKaaMaal, IndianDealsForum, Grabon/CouponDunia-adjacent listing pages, and general "best deal Telegram channels/bots" roundup lists. Many of these accept free submissions and are themselves reasonably well-linked, so they pass real authority.
3. **Cross-promote with the existing Telegram channels the deals are sourced from.** Since the product already pulls from active Telegram channels (`apps/api/src/services/poller.ts`), there's a built-in relationship to leverage: ask channel admins to link `dealdost.shop` in their channel description/pinned message as the "web version" of their feed. Telegram channel bios aren't crawlable backlinks themselves, but admins of those channels often also run associated blogs/websites that are crawlable — that's the actual link-building angle.
4. **List on Product Hunt / IndieHackers / BetaList-style launch directories** if/when the product is ready for public launch — these sites are well-indexed and commonly link out to submissions, giving an early authoritative referring domain.

### Medium-term (Low/Medium priority, ongoing)

5. **Build 1–2 genuinely link-worthy content assets** (e.g., a "Best Diwali/Republic Day deals roundup" page or a live price-drop leaderboard) that deal-roundup bloggers and Reddit/forum users naturally reference. Per the sitemap/content audit findings elsewhere in this report, individual deal permalink pages don't exist yet — those would also make far better link targets than the current list-only pages once shipped.
6. **Monitor, don't chase, directory submissions.** Avoid low-quality "SEO directory" or PBN-style bulk submission services — for a niche this size those read as manipulative link schemes rather than genuine value and aren't worth the risk given [[backlink-quality]] toxic-link patterns (generic directories, footer/sidewide links, link networks) are exactly the category commercial spam detectors flag first.
7. **Re-run this backlink audit in 60–90 days** after outreach begins, and again once Moz/Bing credentials are added — Common Crawl updates quarterly, so near-term changes in a fresh domain's link profile won't show up here for a few months regardless of actual progress.

### Not recommended right now

- **Disavow file / toxic link cleanup** — not applicable; there is no link profile to clean.
- **Competitor gap analysis** — would require Moz/DataForSEO (Tier 1/3) to be meaningful; skip until at least Moz is configured.
