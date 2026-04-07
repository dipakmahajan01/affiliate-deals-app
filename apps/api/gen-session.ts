/**
 * Run this ONCE to generate TELEGRAM_SESSION string.
 * Usage: npx tsx gen-session.ts
 * Paste the printed session string into apps/api/.env as TELEGRAM_SESSION=
 */
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import * as readline from 'readline';
import dotenv from 'dotenv';
dotenv.config();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

const API_ID = parseInt(process.env.TELEGRAM_API_ID ?? '0', 10);
const API_HASH = process.env.TELEGRAM_API_HASH ?? '';

if (!API_ID || !API_HASH) {
  console.error('Set TELEGRAM_API_ID and TELEGRAM_API_HASH in your env first.');
  process.exit(1);
}

(async () => {
  const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
    connectionRetries: 3,
  });

  await client.start({
    phoneNumber: () => ask('Enter your Telegram phone number (e.g. +911234567890): '),
    password: () => ask('Enter 2FA password (leave blank if none): '),
    phoneCode: () => ask('Enter the OTP code Telegram sent you: '),
    onError: (err) => console.error(err),
  });

  const session = client.session.save() as unknown as string;
  console.log('\n✅ Your TELEGRAM_SESSION string:\n');
  console.log(session);
  console.log('\nPaste this into apps/api/.env as:\nTELEGRAM_SESSION=' + session);

  rl.close();
  await client.disconnect();
  process.exit(0);
})();
