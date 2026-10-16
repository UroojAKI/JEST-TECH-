import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/workspace",
        permanent: false,
      },
      {
        source: "/sales/leads",
        destination: "/crm/leads",
        permanent: true,
      },
      {
        source: "/sales/proposals",
        destination: "/sales/quotations",
        permanent: true,
      },
      {
        source: "/workspace/sales/leads",
        destination: "/crm/leads",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.INTERNAL_API_URL || "http://localhost:4000"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
