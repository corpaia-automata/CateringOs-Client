import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Browsers request /favicon.ico first; serve the PNG so the tab icon loads.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/favicon.png" }];
  },
};

export default nextConfig;
