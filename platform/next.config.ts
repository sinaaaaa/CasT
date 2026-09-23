import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];

    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // Must come after /:path* so SAMEORIGIN wins for Unity (embedded in /play iframe).
        source: "/unity/:path*",
        headers: [
          ...securityHeaders,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // Always fetch fresh loader config so new hashed .wasm/.data bundles are picked up.
        source: "/unity/index.html",
        headers: [
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
        ],
      },
      {
        // Unity WebGL: Vercel on-the-fly Brotli (Content-Encoding: br) breaks
        // WebAssembly.instantiateStreaming → "both async and sync fetching of the wasm failed".
        // no-transform tells the CDN not to recompress these binaries.
        source: "/unity/Build/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable, no-transform",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=31536000, immutable, no-transform",
          },
        ],
      },
      {
        source: "/unity/Build/:file*.wasm",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable, no-transform",
          },
        ],
      },
      {
        source: "/unity/Build/:file*.data",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable, no-transform",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
