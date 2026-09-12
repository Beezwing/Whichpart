import { NextRequest, NextResponse } from "next/server";

// The API lives on a different domain in production (Railway vs this app's
// Vercel domain). Calling it directly from the browser makes every request
// cross-site, and mobile browsers (Safari's ITP, and increasingly Chrome)
// block or drop cross-site cookies -- login would appear to succeed, then
// the very next request came back 401 because the auth cookie never made
// it back. Proxying /api/* through this same origin makes it first-party
// instead, which fixes that everywhere at once (fetches and <img> alike).
//
// This is a hand-written proxy rather than next.config.ts's declarative
// `rewrites()` because Vercel's rewrite destinations go through their own
// DNS-safety check, which returned DNS_HOSTNAME_RESOLVED_PRIVATE against
// Railway's domain from Vercel's edge network -- a false positive with no
// user-facing workaround. A plain outbound fetch() from a route handler
// isn't subject to that check.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const target = new URL(`${API_ORIGIN}/api/${path.join("/")}${req.nextUrl.search}`);

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");
  // Only accept-encoding, not the actual compressed bytes we can't re-frame.
  headers.delete("accept-encoding");

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: "manual",
  });

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") resHeaders.set(key, value);
  });
  // Set-Cookie can't be merged into one header like every other field --
  // getSetCookie() is the only way to get each cookie back out separately.
  for (const cookie of upstream.headers.getSetCookie()) {
    resHeaders.append("set-cookie", cookie);
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders });
}

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

async function handle(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(req, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
