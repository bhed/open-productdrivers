import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack configuration for monorepo
  turbopack: {
    root: '../../',
  },
};

export default nextConfig;
