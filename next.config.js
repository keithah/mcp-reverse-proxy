/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
      {
        source: '/mcp/:path*',
        destination: 'http://localhost:8080/mcp/:path*',
      },
    ];
  },
};

module.exports = nextConfig;