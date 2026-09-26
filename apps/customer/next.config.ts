import type { NextConfig } from "next";
import { FIXED_SECURITY_HEADERS } from "@senso/security";

// The fixed security headers go on every response. The Content-Security-
// Policy is set per request in proxy.ts, since it carries a nonce.
const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: FIXED_SECURITY_HEADERS }];
  },
};

export default nextConfig;
