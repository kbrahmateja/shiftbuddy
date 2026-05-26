/** @type {import('next').NextConfig} */
const { setupDevPlatform } = process.env.NODE_ENV === "development"
  ? require("@cloudflare/next-on-pages/next-dev")
  : { setupDevPlatform: () => {} };

if (process.env.NODE_ENV === "development") {
  setupDevPlatform();
}

const nextConfig = {
  // Required for Cloudflare Pages edge runtime
  experimental: {
    // Allow Server Actions on edge
  },
};

module.exports = nextConfig;
