import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@finance-app/shared'],
  async redirects() {
    return [
      { source: '/loans', destination: '/bills?tab=dividas', permanent: false },
      { source: '/recurring', destination: '/bills?tab=fixas', permanent: false },
    ];
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
};

export default nextConfig;
