import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "manifest-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self'",
  "upgrade-insecure-requests"
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: projectRoot,
  turbopack: { root: projectRoot },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-DNS-Prefetch-Control", value: "off" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Frame-Options", value: "DENY" }
      ]
    }];
  }
};

export default nextConfig;
