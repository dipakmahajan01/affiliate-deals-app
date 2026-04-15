import cron from 'node-cron';
import { TelegramClient } from 'telegram';
import { NewMessage, NewMessageEvent } from 'telegram/events/index.js';
import { StringSession } from 'telegram/sessions/index.js';
import { Channel } from '../models/Channel';
import { Deal } from '../models/Deal';
import { Product } from '../models/Product';
import { parseMessage, categorize } from './parser';
import { resolveShortUrl, buildAffiliateUrl, detectSource } from './affiliate';
import { scrapeProduct } from './scraper';

// Channels whose messages get page-scraped into the products collection
const SCRAPE_CHANNELS = new Set(['-1001803002117']);

/** Escape special regex chars in a product title for safe case-insensitive matching. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let client: TelegramClient | null = null;

// Cache: channel_username (stored in DB) → entity resolved from dialogs
const entityCache = new Map<string, object>();

async function buildEntityCache(tg: TelegramClient): Promise<void> {
  const dialogs = await tg.getDialogs({ limit: 200 });
  for (const dialog of dialogs) {
    const entity = dialog.entity as { className?: string; username?: string; id?: { value?: bigint } | bigint };
    if (entity?.className !== 'Channel') continue;

    const rawId = entity.id;
    const numericId = typeof rawId === 'object' && rawId !== null && 'value' in rawId ? rawId.value : rawId as bigint;
    const numericForm = `-100${numericId}`;

    entityCache.set(numericForm, entity);
    if (entity.username) entityCache.set(entity.username, entity);
  }
  console.log(`[Telegram] Entity cache built: ${entityCache.size} entries`);
}

async function resolveEntity(channelUsername: string): Promise<object> {
  if (entityCache.has(channelUsername)) return entityCache.get(channelUsername)!;
  // Public username — resolve directly
  const tg = await getTelegramClient();
  const entity = await tg.getEntity(channelUsername);
  entityCache.set(channelUsername, entity as object);
  return entity as object;
}

async function getTelegramClient(): Promise<TelegramClient> {
  if (client) {
    console.log('[Telegram] Reusing existing client connection');
    return client;
  }

  const apiId = parseInt(process.env.TELEGRAM_API_ID ?? '0', 10);
  const apiHash = process.env.TELEGRAM_API_HASH ?? '';
  const session = new StringSession(process.env.TELEGRAM_SESSION ?? '');

  console.log(`[Telegram] Connecting with API_ID=${apiId}...`);
  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();
  console.log('[Telegram] Connected successfully');
  return client;
}

type RawMessage = { id: number; text?: string; date?: number };

async function  processMessage(channelUsername: string, msg: RawMessage): Promise<'saved' | 'duplicate' | 'skipped'> {
  if (!msg.text) return 'skipped';
  console.log("msg.text", msg.text);
  const parsed = parseMessage(msg.text);
  if (!parsed.url || parsed.price === null) return 'skipped';

  const resolvedUrl = await resolveShortUrl(parsed.url);
  const source = detectSource(resolvedUrl);
  if (!source) return 'skipped';

  const affiliateUrl = await buildAffiliateUrl(resolvedUrl);
  if (!affiliateUrl) return 'skipped';

  const category = categorize(parsed.product_title);

  if (SCRAPE_CHANNELS.has(channelUsername)) {
    return processScrapedProduct(channelUsername, msg, parsed, resolvedUrl, affiliateUrl, source, category);
  }

  // Affiliate URL dedup: same ASIN/Flipkart product always produces the same affiliate_url
  // — this is the most reliable cross-channel duplicate check.
  const affiliateUrlDup = await Deal.findOne({ affiliate_url: affiliateUrl }).select('_id').lean();
  if (affiliateUrlDup) return 'duplicate';

  // Title+price dedup: catches edge cases where the same product has a different URL variant
  if (parsed.product_title && parsed.price !== null) {
    const titlePriceDup = await Deal.findOne({
      product_title: { $regex: new RegExp(`^${escapeRegex(parsed.product_title.trim())}$`, 'i') },
      price: parsed.price,
    }).select('_id').lean();
    if (titlePriceDup) return 'duplicate';
  }

  try {
    const result = await Deal.updateOne(
      { channel_id: channelUsername, message_id: msg.id },
      {
        $setOnInsert: {
          channel_id: channelUsername,
          message_id: msg.id,
          product_title: parsed.product_title,
          price: parsed.price,
          original_price: parsed.original_price ?? undefined,
          coupon_text: parsed.coupon_text ?? undefined,
          original_url: parsed.url,
          resolved_url: resolvedUrl,
          affiliate_url: affiliateUrl,
          category,
          source,
          posted_at: new Date((msg.date ?? 0) * 1000),
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      // Scrape image in background — don't block the poll
      scrapeProduct(resolvedUrl, source).then((scraped) => {
        if (!scraped) return;
        const patch: Record<string, unknown> = {};
        if (scraped.title?.trim()) patch.product_title = scraped.title.trim();
        if (scraped.image_url) patch.image_url = scraped.image_url;
        if (scraped.rating != null) patch.rating = scraped.rating;
        if (scraped.bank_offers?.length) patch.bank_offers = scraped.bank_offers;
        if (Object.keys(patch).length > 0) {
          Deal.updateOne({ channel_id: channelUsername, message_id: msg.id }, { $set: patch }).catch(() => {});
        }
      }).catch(() => {});
      return 'saved';
    }
    return 'duplicate';
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) return 'duplicate';
    console.error(`[Poller] ❌ DB error:`, err);
    return 'skipped';
  }
}

type ParsedDealPartial = { product_title: string; price: number | null; original_price?: number | null; coupon_text?: string | null; url?: string | null };

async function processScrapedProduct(
  channelUsername: string,
  msg: RawMessage,
  parsed: ParsedDealPartial,
  resolvedUrl: string,
  affiliateUrl: string,
  source: 'Amazon' | 'Flipkart',
  category: string
): Promise<'saved' | 'duplicate' | 'skipped'> {
  // Affiliate URL dedup: same ASIN/Flipkart product always produces the same affiliate_url
  // — this is the most reliable cross-channel duplicate check.
  const affiliateUrlDup = await Product.findOne({ affiliate_url: affiliateUrl }).select('_id').lean();
  if (affiliateUrlDup) return 'duplicate';

  // Title+price dedup: catches edge cases where the same product has a different URL variant
  if (parsed.product_title && parsed.price !== null) {
    const titlePriceDup = await Product.findOne({
      product_title: { $regex: new RegExp(`^${escapeRegex(parsed.product_title.trim())}$`, 'i') },
      price: parsed.price,
    }).select('_id').lean();
    if (titlePriceDup) return 'duplicate';
  }

  const scraped = await scrapeProduct(resolvedUrl, source);
  const scrapeStatus = scraped ? 'success' : 'failed';

  try {
    const postedAt = new Date((msg.date ?? 0) * 1000);
    const result = await Product.updateOne(
      { channel_id: channelUsername, message_id: msg.id },
      {
        $setOnInsert: {
          channel_id: channelUsername,
          message_id: msg.id,
          price: parsed.price!,
          original_price: parsed.original_price ?? undefined,
          coupon_text: parsed.coupon_text ?? undefined,
          original_url: parsed.url ?? resolvedUrl,
          resolved_url: resolvedUrl,
          affiliate_url: affiliateUrl,
          category,
          source,
          posted_at: postedAt,
        },
        $set: {
          product_title: (scraped?.title?.trim() || parsed.product_title) as string,
          scrape_status: scrapeStatus,
          scraped_at: new Date(),
          ...(scraped?.image_url ? { image_url: scraped.image_url } : {}),
          ...(scraped?.description ? { description: scraped.description } : {}),
          ...(scraped?.rating != null ? { rating: scraped.rating } : {}),
          ...(scraped?.features?.length ? { features: scraped.features } : {}),
          ...(scraped?.bank_offers?.length ? { bank_offers: scraped.bank_offers } : {}),
        },
      },
      { upsert: true }
    );
    return result.upsertedCount > 0 ? 'saved' : 'duplicate';
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) return 'duplicate';
    console.error(`[Poller] ❌ Product DB error:`, err);
    return 'skipped';
  }
}

async function pollChannel(channelUsername: string, limit = 100): Promise<void> {
  console.log(`\n[Poller] ▶ Starting poll for ${channelUsername} (limit=${limit})`);
  const tg = await getTelegramClient();

  const entity = await resolveEntity(channelUsername) as Parameters<typeof tg.getMessages>[0];
  const messages = await tg.getMessages(entity, { limit });
  console.log("messages", messages);
  console.log(`[Poller] Got ${messages.length} messages`);

  let saved = 0, skipped = 0, duplicates = 0;

  for (const msg of messages) {
    console.log("msg", msg);
    const outcome = await processMessage(channelUsername, msg);
    console.log("outcome", outcome);
    if (outcome === 'saved') saved++;
    else if (outcome === 'duplicate') duplicates++;
    else skipped++;
  }

  await Channel.updateOne({ channel_username: channelUsername }, { last_polled_at: new Date() });
  console.log(`[Poller] ✔ Done @${channelUsername} — saved: ${saved} | duplicates: ${duplicates} | skipped: ${skipped}\n`);
}

async function startRealtime(): Promise<void> {
  const tg = await getTelegramClient();
  await buildEntityCache(tg);
  const channels = await Channel.find({ is_active: true });

  if (channels.length === 0) {
    console.log('[Realtime] No active channels — listener not started');
    return;
  }

  const usernames = channels.map((c) => c.channel_username);
  console.log(`[Realtime] Listening for new messages in: ${usernames.map((u) => '@' + u).join(', ')}`);

  tg.addEventHandler(async (event: NewMessageEvent) => {
    const msg = event.message;
    if (!msg) return;

    // Resolve the channel username from the peer
    const peer = msg.peerId as { className?: string; channelId?: { value?: bigint } };
    if (peer?.className !== 'PeerChannel') return;

    // Match against active channel list by peer channel ID
    const peerId = peer?.channelId?.value;
    if (!peerId) return;

    // Build the -100xxx form to match against stored usernames
    const numericForm = `-100${peerId}`;
    let channelUsername: string | null = null;

    if (usernames.includes(numericForm)) {
      channelUsername = numericForm;
    } else {
      // Fallback: try matching by @username for public channels
      try {
        const entity = await tg.getEntity(msg.peerId) as { username?: string };
        if (entity?.username && usernames.includes(entity.username)) {
          channelUsername = entity.username;
        }
      } catch {
        return;
      }
    }

    if (!channelUsername) return;

    console.log(`[Realtime] New message in @${channelUsername} — msg#${msg.id}`);
    const outcome = await processMessage(channelUsername, msg);
    console.log("outcome", outcome);
    if (outcome === 'saved') {
      console.log(`[Realtime] ✅ Deal saved from @${channelUsername} msg#${msg.id}`);
      await Channel.updateOne({ channel_username: channelUsername }, { last_polled_at: new Date() });
    } else {
      console.log(`[Realtime] ⏭  msg#${msg.id} — ${outcome}`);
    }
  }, new NewMessage({}));

  console.log('[Realtime] Event handler registered');
}

export async function startPoller(): Promise<void> {
  const apiId = process.env.TELEGRAM_API_ID;
  if (!apiId || apiId === 'your_api_id') {
    console.warn('Telegram credentials not configured — poller disabled');
    return;
  }

  // Real-time listener for instant deal capture
  await startRealtime();

  // Cron as catch-up fallback (every 10 min)
  cron.schedule('*/10 * * * *', async () => {
    console.log(`\n[Poller] ⏰ Catch-up cron at ${new Date().toISOString()}`);
    const channels = await Channel.find({ is_active: true });
    console.log(`[Poller] Polling ${channels.length} channels`);
    console.log("channels", channels);
    for (const ch of channels) {
      try {
        await pollChannel(ch.channel_username);
      } catch (err) {
        console.error(`[Poller] ❌ Error polling @${ch.channel_username}:`, err);
      }
    }
    console.log('[Poller] ✅ Catch-up done\n');
  });

  console.log('[Poller] Real-time listener active + catch-up cron scheduled (every 10 min)');
}

export async function getTelegramChannels(): Promise<{ username: string; title: string }[]> {
  const tg = await getTelegramClient();
  const dialogs = await tg.getDialogs({ limit: 200 });
  const channels: { username: string; title: string }[] = [];

  for (const dialog of dialogs) {
    const entity = dialog.entity as { className?: string; username?: string; title?: string };
    if (entity?.className === 'Channel' && entity.username) {
      channels.push({ username: entity.username, title: entity.title ?? entity.username });
    }
  }

  return channels;
}

// Export for manual triggering (admin/testing)
export { pollChannel };
