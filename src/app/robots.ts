import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/fitur', '/harga', '/perbandingan', '/studi-kasus', '/blog', '/demo'],
      disallow: [
        '/dashboard',
        '/extract',
        '/history',
        '/users',
        '/rules',
        '/prb-exempt',
        '/pending-bpjs',
        '/results',
        '/login',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
