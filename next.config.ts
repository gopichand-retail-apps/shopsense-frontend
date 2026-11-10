import type { NextConfig } from "next";
import { isMock } from "./src/config";

function getMockApiOrigin(): string | undefined {
  const configuredOrigin = process.env.SHOPSENSE_MOCK_API_URL?.trim();
  if (configuredOrigin || process.env.NODE_ENV !== "development") {
    return configuredOrigin;
  }
  return process.env.SHOPSENSE_API_URL?.trim() || "http://127.0.0.1:5802";
}

function getApiOrigin(): string {
  const configuredOrigin = isMock ? getMockApiOrigin() : process.env.SHOPSENSE_REAL_API_URL?.trim();
  if (!configuredOrigin) {
    throw new Error(
      isMock
        ? "SHOPSENSE_MOCK_API_URL is required for production builds when NEXT_PUBLIC_IS_MOCK=true."
        : "SHOPSENSE_REAL_API_URL is required when NEXT_PUBLIC_IS_MOCK=false.",
    );
  }
  let apiUrl: URL;
  try {
    apiUrl = new URL(configuredOrigin);
  } catch {
    throw new Error("The selected ShopSense API must be an absolute HTTP(S) URL.");
  }
  if (
    (apiUrl.protocol !== "http:" && apiUrl.protocol !== "https:") ||
    apiUrl.pathname !== "/" ||
    apiUrl.search ||
    apiUrl.hash
  ) {
    throw new Error("The selected ShopSense API must be an HTTP(S) origin.");
  }
  return apiUrl.origin;
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  distDir: process.env.SHOPSENSE_NEXT_DIST_DIR ?? ".next",
  async rewrites() {
    const apiOrigin = getApiOrigin();
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
