import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://dealdost.shop';
const SITE_NAME = 'DealDost';
const DEFAULT_DESCRIPTION =
  'Best Amazon & Flipkart deals, handpicked from Telegram every day. Trending offers, price drops and daily discounts in one place.';
const DEFAULT_IMAGE = `${SITE_URL}/icon-512.png`;

interface SeoProps {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = DEFAULT_IMAGE,
  noindex = false,
  jsonLd,
}: SeoProps) {
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const canonical = `${SITE_URL}${path}`;
  const ldEntries = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {ldEntries.map((entry, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(entry)}
        </script>
      ))}
    </Helmet>
  );
}

export { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION };
