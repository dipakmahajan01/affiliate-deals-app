import nodemailer, { Transporter } from 'nodemailer';

export interface DigestProduct {
  _id: string;
  product_title: string;
  price: number;
  previous_price?: number;
  price_drop_percent?: number;
  affiliate_url: string;
  image_url?: string;
}

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    console.warn('[Mailer] EMAIL_USER/EMAIL_PASS not configured — emails disabled');
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error(`[Mailer] Failed to send to ${to}:`, err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c] as string));
}

export function renderWelcomeEmail(name: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
    <h2>Welcome to DealDost, ${escapeHtml(name)}!</h2>
    <p>You're all set. We'll send you a digest of the best price drops twice a day, at 10 AM and 9 PM.</p>
  </div>`;
}

export function renderDigestEmail(products: DigestProduct[]): string {
  const webUrl = process.env.WEB_APP_URL ?? 'http://localhost:3000';
  // All 5 products link to the same DealDost digest page (not straight to the affiliate link),
  // which shows the full list and routes each "Buy Now" through the tracked click flow.
  const ids = products.map((p) => p._id).join(',');
  const digestPageUrl = `${webUrl}/digest?ids=${encodeURIComponent(ids)}`;

  const rows = products
    .map(
      (p) => `
    <tr>
      <td style="padding:8px"><img src="${escapeHtml(p.image_url ?? '')}" width="80" alt="" /></td>
      <td style="padding:8px">
        <a href="${escapeHtml(digestPageUrl)}" style="font-weight:bold;text-decoration:none;color:#111">${escapeHtml(p.product_title)}</a><br/>
        ₹${p.price}${p.previous_price ? ` <s style="color:#999">₹${p.previous_price}</s>` : ''}
        ${p.price_drop_percent ? `<span style="color:#0a7d28"> ${p.price_drop_percent}% off</span>` : ''}
      </td>
    </tr>`
    )
    .join('');

  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
    <h2>Today's Top Price Drops</h2>
    <table cellpadding="0" cellspacing="0">${rows}</table>
    <p style="margin-top:16px">
      <a href="${escapeHtml(digestPageUrl)}" style="display:inline-block;background:#f97316;color:#fff;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:8px">
        View all 5 deals on DealDost →
      </a>
    </p>
  </div>`;
}
