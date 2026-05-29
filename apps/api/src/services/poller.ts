import cron from 'node-cron';
import { TelegramClient } from 'telegram';
import { NewMessage, NewMessageEvent } from 'telegram/events/index.js';
import { StringSession } from 'telegram/sessions/index.js';
import { Channel } from '../models/Channel';
import { Message } from '../models/Message';
import { Product } from '../models/Product';
import { parseMessage, categorize, normalizeTitle } from './parser';
import type { DealSource } from '@deals/types';
import { resolveShortUrl, buildAffiliateUrl, detectSource } from './affiliate';
import { scrapeProduct } from './scraper';

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
    return client;
  }

  const apiId = parseInt(process.env.TELEGRAM_API_ID ?? '0', 10);
  const apiHash = process.env.TELEGRAM_API_HASH ?? '';
  const session = new StringSession(process.env.TELEGRAM_SESSION ?? '');

  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();
  return client;
}

type RawMessage = { id: number; text?: string; date?: number };

async function  processMessage(channelUsername: string, msg: RawMessage): Promise<'saved' | 'duplicate' | 'skipped'> {
  if (!msg.text) return 'skipped';

  // Persist raw message before any processing
  await Message.updateOne(
    { channel_id: channelUsername, message_id: msg.id },
    {
      $setOnInsert: {
        channel_id: channelUsername,
        message_id: msg.id,
        channel_name: channelUsername,
        raw_text: msg.text,
        posted_at: new Date((msg.date ?? 0) * 1000),
        has_url: /https?:\/\//i.test(msg.text),
        processed: false,
      },
    },
    { upsert: true }
  ).catch(() => {});

  const parsed = parseMessage(msg.text);
  if (!parsed.url || parsed.price === null) return 'skipped';

  const resolvedUrl = await resolveShortUrl(parsed.url);
  let source = detectSource(resolvedUrl);
  if (!source && parsed.url) source = detectSource(parsed.url);
  if (!source) return 'skipped';

  const affiliateUrl = await buildAffiliateUrl(resolvedUrl, parsed.url);
  if (!affiliateUrl) return 'skipped';

  const category = categorize(parsed.product_title);

  return processScrapedProduct(channelUsername, msg, parsed, resolvedUrl, affiliateUrl, source, category);
}

type ParsedDealPartial = { product_title: string; price: number | null; original_price?: number | null; coupon_text?: string | null; url?: string | null };

async function processScrapedProduct(
  channelUsername: string,
  msg: RawMessage,
  parsed: ParsedDealPartial,
  resolvedUrl: string,
  affiliateUrl: string,
  source: DealSource,
  category: string
): Promise<'saved' | 'duplicate' | 'skipped'> {
  // Affiliate URL dedup: same ASIN / Flipkart path / Myntra URL produces the same affiliate_url
  // — this is the most reliable cross-channel duplicate check.
  const affiliateUrlDup = await Product.findOne({ affiliate_url: affiliateUrl }).select('_id product_title price').lean();
  if (affiliateUrlDup) {
    return 'duplicate';
  }

  const normTitle = normalizeTitle(parsed.product_title);

  try {
    const scraped = await scrapeProduct(resolvedUrl, source).catch(() => null);
    const scrapeStatus = scraped ? 'success' : 'failed';

    // Prefer scraped (live) price over the parsed Telegram price; fall back to parsed if scrape failed.
    const finalPrice = scraped?.price ?? parsed.price!;
    const finalOriginalPrice = scraped?.original_price ?? parsed.original_price ?? undefined;

    // Title+price dedup runs against the *final* price, not the parsed-from-message price, so the
    // same product reposted in two channels with different message text doesn't insert twice.
    if (parsed.product_title && finalPrice != null) {
      const titlePriceDup = await Product.findOne({
        normalized_title: normTitle,
        price: finalPrice,
      }).select('_id product_title price').lean();
      if (titlePriceDup) {
        return 'duplicate';
      }
    }

    const postedAt = new Date((msg.date ?? 0) * 1000);
    const result = await Product.updateOne(
      { channel_id: channelUsername, message_id: msg.id },
      {
        $setOnInsert: {
          channel_id: channelUsername,
          message_id: msg.id,
          normalized_title: normTitle,
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
          price: finalPrice,
          ...(finalOriginalPrice != null ? { original_price: finalOriginalPrice } : {}),
          ...(scraped?.image_url ? { image_url: scraped.image_url } : {}),
          ...(scraped?.description ? { description: scraped.description } : {}),
          ...(scraped?.rating != null ? { rating: scraped.rating } : {}),
          ...(scraped?.features?.length ? { features: scraped.features } : {}),
          ...(scraped?.bank_offers?.length ? { bank_offers: scraped.bank_offers } : {}),
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0) {
      Message.updateOne({ channel_id: channelUsername, message_id: msg.id }, { $set: { processed: true } }).catch(() => {});
      return 'saved';
    }
    return 'duplicate';
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      return 'duplicate';
    }
    console.error(`[Poller] ❌ Product DB error:`, err);
    return 'skipped';
  }
}

async function pollChannel(channelUsername: string, limit = 100): Promise<void> {
  const tg = await getTelegramClient();

  const entity = await resolveEntity(channelUsername) as Parameters<typeof tg.getMessages>[0];
  const messages = await tg.getMessages(entity, { limit });

  let saved = 0, skipped = 0, duplicates = 0;

  for (const msg of messages) {
    try {
      const outcome = await processMessage(channelUsername, msg);
      if (outcome === 'saved') saved++;
      else if (outcome === 'duplicate') duplicates++;
      else skipped++;
    } catch (err) {
      console.error(`[Poller] ❌ Unhandled error processing msg#${(msg as { id?: number }).id}:`, err);
      skipped++;
    }
  }

  await Channel.updateOne({ channel_username: channelUsername }, { last_polled_at: new Date() });
}

async function startRealtime(): Promise<void> {
  const tg = await getTelegramClient();
  await buildEntityCache(tg);
  const channels = await Channel.find({ is_active: true });

  if (channels.length === 0) {
    return;
  }

  const usernames = channels.map((c) => c.channel_username);

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

    const outcome = await processMessage(channelUsername, msg);
    if (outcome === 'saved') {
      await Channel.updateOne({ channel_username: channelUsername }, { last_polled_at: new Date() });
    }
  }, new NewMessage({}));
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
    const channels = await Channel.find({ is_active: true });
    for (const ch of channels) {
      try {
        await pollChannel(ch.channel_username);
      } catch (err) {
        console.error(`[Poller] ❌ Error polling @${ch.channel_username}:`, err);
      }
    }
  });
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
