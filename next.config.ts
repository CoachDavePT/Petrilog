import type { NextConfig } from 'next'

// Security headers — .claude/rules/security.md, docs/stacks/framework-nextjs.md.
// Referrer-Policy also keeps the one-time token of an email link from reaching other sites.
const nextConfig: NextConfig = {
  // `next dev` logs every Server Function call with its arguments — that would print passwords in
  // plain text (PROJ-1 spec: passwords are never logged).
  logging: { serverFunctions: false },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
}

export default nextConfig
