/**
 * Lists all Telegram channels/groups the account has joined.
 * Usage: npx tsx list-channels.ts
 */
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import dotenv from 'dotenv';
dotenv.config();

const API_ID = parseInt(process.env.TELEGRAM_API_ID ?? '0', 10);
const API_HASH = process.env.TELEGRAM_API_HASH ?? '';
const SESSION = process.env.TELEGRAM_SESSION ?? '';

const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, {
  connectionRetries: 3,
});

(async () => {
  await client.connect();

  const dialogs = await client.getDialogs({ limit: 200 });

  console.log('\n=== Your Telegram Channels ===\n');
  for (const dialog of dialogs) {
    const entity = dialog.entity as {
      className?: string;
      username?: string;
      title?: string;
      id?: { value?: bigint } | bigint;
    };

    if (entity?.className === 'Channel' || entity?.className === 'Chat') {
      const rawId = entity.id;
      const numericId = typeof rawId === 'object' && rawId !== null && 'value' in rawId
        ? rawId.value
        : rawId;
      const channelId = `-100${numericId}`;
      const username = entity.username ? `@${entity.username}` : '(private — no username)';

      console.log(`Title    : ${entity.title}`);
      console.log(`Username : ${username}`);
      console.log(`ID       : ${channelId}`);
      console.log('---');
    }
  }

  await client.disconnect();
  process.exit(0);
})();
