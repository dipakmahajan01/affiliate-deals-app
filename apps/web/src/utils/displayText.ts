function looksLikeRawPayload(text: string): boolean {
  return (
    /"[a-zA-Z0-9_]+":/.test(text) ||
    /[{}]{2,}/.test(text) ||
    text.includes('contentImpressionId') ||
    text.includes('widgetType') ||
    text.includes('offerSubTitleRC') ||
    text.includes('trackingType') ||
    text.includes('productId')
  );
}

export function cleanDisplayText(value: string | undefined | null): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text || text.toLowerCase() === 'na' || text.toLowerCase() === 'n/a') return null;
  if (looksLikeRawPayload(text)) return null;
  return text;
}

export function cleanOfferList(values: string[] | undefined | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values ?? []) {
    const text = cleanDisplayText(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}
