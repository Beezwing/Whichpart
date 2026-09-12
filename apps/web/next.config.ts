import type { NextConfig } from "next";

// /api/* is proxied to the real backend by src/app/api/[...path]/route.ts,
// not by a rewrite here -- see that file for why.
const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
