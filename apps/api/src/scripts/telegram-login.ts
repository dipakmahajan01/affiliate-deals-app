/**
 * One-time interactive login to generate a fresh TELEGRAM_SESSION string for gramjs.
 *
 * Usage (from repo root):
 *   pnpm --filter @deals/api run telegram:login
 *
 * Reads TELEGRAM_API_ID and TELEGRAM_API_HASH from apps/api/.env.
 * Prompts for phone number, login code, and 2FA password (if enabled).
 * Prints a StringSession value at the end — paste it into apps/api/.env as
 *   TELEGRAM_SESSION=<value>
 * (uncommented, single line, no quotes).
 */
import 'dotenv/config';
import { createInterface } from 'readline';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

function prompt(question: string, opts: { mask?: boolean } = {}): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  if (opts.mask) {
    // Best-effort echo suppression for the password line.
    const w = (rl as unknown as { _writeToOutput?: (s: string) => void });
    w._writeToOutput = (s: string) => {
      if (s.includes(question)) process.stdout.write(s);
      else process.stdout.write('*');
    };
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      if (opts.mask) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function run() {
  const apiIdRaw = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  if (!apiIdRaw || !apiHash) {
    process.stderr.write('TELEGRAM_API_ID / TELEGRAM_API_HASH must be set in apps/api/.env\n');
    process.exit(1);
  }
  const apiId = parseInt(apiIdRaw, 10);
  if (!Number.isFinite(apiId)) {
    process.stderr.write(`TELEGRAM_API_ID is not a number: ${apiIdRaw}\n`);
    process.exit(1);
  }

  const session = new StringSession('');
  const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 3 });

  await client.start({
    phoneNumber: () => prompt('Phone number (with country code, e.g. +91...): '),
    phoneCode: () => prompt('Login code from Telegram: '),
    password: () => prompt('2FA password (leave blank if none): ', { mask: true }),
    onError: (err) => {
      process.stderr.write(`Login error: ${err instanceof Error ? err.message : String(err)}\n`);
    },
  });

  const sessionString = (client.session as StringSession).save();
  process.stdout.write('\n=========================================================\n');
  process.stdout.write('Login successful. Copy the line below into apps/api/.env:\n');
  process.stdout.write('=========================================================\n\n');
  process.stdout.write(`TELEGRAM_SESSION=${sessionString}\n\n`);
  process.stdout.write('(Make sure the line is NOT commented out with `#`.)\n');

  await client.disconnect();
  process.exit(0);
}

run().catch((err) => {
  process.stderr.write(`FATAL: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
