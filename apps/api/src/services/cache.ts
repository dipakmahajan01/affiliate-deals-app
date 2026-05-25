


/**
 * Thin Redis cache wrapper for public listing endpoints.
 *
 * TTL-based read-through cache. No explicit invalidation — the data behind these
 * endpoints only changes when the 10-min poller or 30-min refresh cron runs, so
 * a short TTL keeps the visible feed within freshness budget without invalidation
 * plumbing.
 *
 * If REDIS_URL is unset, or the client fails to connect, the wrapper degrades to
 * a pass-through. The API keeps working without Redis.
 */
import Redis from 'ioredis';

type State = 'uninit' | 'ready' | 'disabled';

let client: Redis | null = null;
let state: State = 'uninit';

function initClient(): void {
  if (state !== 'uninit') return;

  const url = process.env.REDIS_URL;
  if (!url) {
    state = 'disabled';
    process.stderr.write('[Cache] disabled — REDIS_URL not set\n');
    return;
  }

  try {
    // lazyConnect so the API doesn't crash at boot if Redis is unreachable.
    client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    client.on('error', (err) => {
      // Switch to disabled after the first error so we stop spamming logs and
      // stop awaiting failing round-trips on every request.
      if (state !== 'disabled') {
        state = 'disabled';
        process.stderr.write(`[Cache] disabled — Redis error: ${err.message}\n`);
      }
    });
    state = 'ready';
  } catch (err) {
    state = 'disabled';
    process.stderr.write(`[Cache] disabled — init error: ${err instanceof Error ? err.message : String(err)}\n`);
  }
}

async function get<T>(key: string): Promise<T | null> {
  initClient();
  if (state !== 'ready' || !client) return null;
  try {
    const raw = await client.get(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  initClient();
  if (state !== 'ready' || !client) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    /* swallow — see error handler on the client */
  }
}

/**
 * Read-through cache helper.
 *
 * NOTE: writes that affect listings (poller upserts, refresh cron updates) do
 * not invalidate cached keys. A new row may take up to `ttlSeconds` to appear
 * in the cached list. That is intentional — the data refresh cadence is 10 min,
 * so a 60–120 s stale window is invisible.
 */
export async function withCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = await get<T>(key);
  if (hit != null) return hit;
  const value = await fn();
  // Don't await the set — let it run in the background so a slow Redis doesn't
  // delay the response. Errors are already swallowed inside set().
  void set(key, value, ttlSeconds);
  return value;
}

export const cache = { get, set, withCache };
