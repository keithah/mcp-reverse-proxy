/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  typescript: {
    // Disable type checking during build for faster Docker builds
    ignoreBuildErrors: true,
  },
  eslint: {
    // Disable ESLint during builds for faster Docker builds
    ignoreDuringBuilds: true,
  },
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

export default nextConfig;