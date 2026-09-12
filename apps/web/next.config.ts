import type { NextConfig } from "next";

// The API lives on a different domain in production (Railway vs this app's
// Vercel domain). Calling it directly from the browser makes every request
// cross-site, and mobile browsers (Safari's ITP, and increasingly Chrome)
// block or drop cross-site cookies -- login would appear to succeed, then
// the very next request came back 401 because the auth cookie never made
// it back. Proxying /api/* through this same origin makes it first-party
// instead, which fixes that everywhere at once (fetches and <img> alike).
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
