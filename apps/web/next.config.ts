import type { NextConfig } from 'next';

const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  transpilePackages: ['@bakimos/api-contracts'],
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${api}/api/v1/:path*` },
      { source: '/docs', destination: `${api}/docs` },
      { source: '/docs/:path*', destination: `${api}/docs/:path*` },
      { source: '/docs-json', destination: `${api}/docs-json` },
      { source: '/docs-yaml', destination: `${api}/docs-yaml` },
    ];
  },
};

export default nextConfig;
