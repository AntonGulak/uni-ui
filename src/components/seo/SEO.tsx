import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title?: string
  description?: string
  keywords?: string
  image?: string
  url?: string
}

const defaultSEO = {
  title: 'UniCalc - Uniswap V3 Liquidity Calculator',
  description: 'Professional Uniswap V3 liquidity calculator. Simulate swaps, analyze price impact, visualize liquidity distribution.',
  keywords: 'Uniswap, V3, liquidity, calculator, DeFi, swap, price impact, slippage, AMM',
  image: 'https://uni-ui.vercel.app/og-image.png',
  url: 'https://uni-ui.vercel.app/',
}

export function SEO({
  title = defaultSEO.title,
  description = defaultSEO.description,
  keywords = defaultSEO.keywords,
  image = defaultSEO.image,
  url = defaultSEO.url,
}: SEOProps) {
  const fullTitle = title === defaultSEO.title ? title : `${title} | UniCalc`

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Canonical */}
      <link rel="canonical" href={url} />
    </Helmet>
  )
}

export default SEO
