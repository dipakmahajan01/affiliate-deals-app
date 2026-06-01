import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { searchProducts, ProductSearchParams } from '../services/productSearch';

const router = Router();

const MODEL = process.env.ASSISTANT_MODEL || 'gemini-2.5-flash';

// Common categories in the catalog — surfaced to the model as a hint (not enforced).
const CATEGORIES = ['Electronics', 'Kitchen', 'Fashion', 'Beauty', 'Books', 'Grocery', 'Sports', 'Home', 'General'];

const SYSTEM_PROMPT = `You are DealGenie, a friendly shopping assistant for DealDost — an Indian deals app that aggregates live offers from Amazon, Flipkart and Myntra.

Your job is to help users find the right product to buy as fast as possible.

Rules:
- To recommend any product you MUST call the \`search_products\` tool. Never invent products, prices, ratings or links — only ever discuss items returned by the tool.
- When the user describes what they want, translate it into a tool call: keywords as \`query\`, plus \`maxPrice\`, \`minRating\`, \`source\` or \`category\` filters when they mention them.
- If the tool returns no matches, say so plainly and suggest how to broaden the search (raise budget, drop a filter, try different keywords). Do not fabricate alternatives.
- You may answer general buying questions (e.g. "what specs matter in a blender?") from your own knowledge, but then tie it back to a concrete \`search_products\` call so the user can act.
- Prices are in Indian Rupees (₹). Keep replies short, warm and skimmable — a sentence or two of guidance, then let the product cards speak. Do not repeat the full product list in prose; the UI shows the cards.
- Common categories: ${CATEGORIES.join(', ')}.`;

// Gemini function declaration for the catalog search tool.
const SEARCH_FUNCTION = {
  name: 'search_products',
  description:
    'Search the live DealDost catalog for products to buy. Returns matching products with title, price, MRP, discount %, rating and store. Call this whenever the user is looking for something to buy or compare.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search keywords, e.g. "wireless earbuds" or "air fryer"' },
      category: { type: 'string', description: `Optional category filter. One of: ${CATEGORIES.join(', ')}` },
      maxPrice: { type: 'number', description: 'Optional maximum price in INR' },
      minRating: { type: 'number', description: 'Optional minimum star rating, 0 to 5' },
      source: { type: 'string', enum: ['Amazon', 'Flipkart', 'Myntra'], description: 'Optional store filter' },
    },
    required: ['query'],
  },
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim()) return null;
    out.push({ role, content: content.trim() });
  }
  if (out[0].role !== 'user' || out[out.length - 1].role !== 'user') return null;
  return out;
}

// Trim a product doc to the small set of fields the model needs to reason about.
function summarizeForModel(p: Record<string, unknown>) {
  return {
    id: String(p._id),
    title: p.product_title,
    price: p.price,
    mrp: p.original_price,
    discountPct: p.discount_percent,
    rating: p.rating,
    store: p.source,
    category: p.category,
  };
}

// POST /v1/assistant/chat — Server-Sent Events stream (Google Gemini backend).
// Events: `text` (token deltas), `deals` (cumulative product cards), `done`, `error`.
router.post('/chat', async (req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Assistant is not configured (missing GEMINI_API_KEY).' });
  }

  const messages = sanitizeMessages(req.body?.messages);
  if (!messages) {
    return res.status(400).json({ error: 'Invalid messages payload.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const ai = new GoogleGenAI({ apiKey });

  // Accumulate the deduped union of products surfaced across tool calls this turn.
  const dealsById = new Map<string, Record<string, unknown>>();

  // Gemini conversation history. Roles are 'user' and 'model' (assistant → model).
  const contents: Array<{ role: 'user' | 'model'; parts: Record<string, unknown>[] }> = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // Abort if the client disconnects. Listen on `res`, not `req`: the request
  // stream's 'close' fires as soon as Node finishes reading the POST body, which
  // would abort us before we ever stream a token. `res` 'close' fires on the
  // actual client disconnect (and harmlessly after res.end(), which we guard).
  let aborted = false;
  res.on('close', () => {
    aborted = true;
  });

  try {
    // Manual streaming tool-use loop: stream text to the client, run the tool server-side,
    // feed results back, repeat until the model answers with no further function calls.
    for (let step = 0; step < 6 && !aborted; step++) {
      const stream = await ai.models.generateContentStream({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: [SEARCH_FUNCTION] }],
        },
      });

      let turnText = '';
      const calls: { name?: string; args?: Record<string, unknown> }[] = [];

      for await (const chunk of stream) {
        if (aborted) break;
        const t = chunk.text;
        if (t) {
          turnText += t;
          send('text', { delta: t });
        }
        const fcs = chunk.functionCalls;
        if (fcs?.length) calls.push(...fcs);
      }
      if (aborted) break;

      if (calls.length === 0) break;

      // Record the model's turn (its function calls) so the next request has full context.
      const modelParts: Record<string, unknown>[] = [];
      if (turnText) modelParts.push({ text: turnText });
      for (const c of calls) modelParts.push({ functionCall: c });
      contents.push({ role: 'model', parts: modelParts });

      // Execute every requested tool call and build the function responses.
      const responseParts: Record<string, unknown>[] = [];
      for (const call of calls) {
        if (call.name !== 'search_products') {
          responseParts.push({ functionResponse: { name: call.name ?? 'unknown', response: { error: 'Unknown tool.' } } });
          continue;
        }
        const input = (call.args ?? {}) as ProductSearchParams;
        const products = (await searchProducts({
          query: input.query,
          category: input.category,
          maxPrice: input.maxPrice,
          minRating: input.minRating,
          source: input.source,
          limit: 8,
        })) as Record<string, unknown>[];

        for (const p of products) {
          dealsById.set(String(p._id), { ...p, item_type: 'product' });
        }

        responseParts.push({
          functionResponse: {
            name: 'search_products',
            response:
              products.length > 0
                ? { products: products.map(summarizeForModel) }
                : { products: [], note: 'No matching products found in the catalog.' },
          },
        });
      }

      // Surface cards as soon as we have them, before the model's final wording streams.
      send('deals', { deals: Array.from(dealsById.values()) });

      contents.push({ role: 'user', parts: responseParts });
    }

    if (!aborted) {
      send('done', { deals: Array.from(dealsById.values()) });
    }
  } catch (err) {
    process.stderr.write(`[Assistant] ${err instanceof Error ? err.message : String(err)}\n`);
    if (!aborted) send('error', { message: 'Assistant failed.' });
  } finally {
    if (!aborted) res.end();
  }
});

export default router;
