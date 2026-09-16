/**
 * Next.js configuration.
 *
 * The browser only ever talks to same-origin relative paths (`/api/...`).
 * These rewrites proxy that traffic to the NestJS API server-side, which keeps
 * the app working behind a reverse proxy / sandboxed preview host where the
 * browser cannot reach `localhost:4000` directly.
 */
const apiTarget = (process.env.API_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sandbox / tunnel preview hosts need to be allowed for HMR + dev requests.
  allowedDevOrigins: ['*.e2b.app', '*.local', 'localhost', '127.0.0.1'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
