import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the lookup route reads the index at runtime, so make sure it ships with the function
  outputFileTracingIncludes: { "/api/lookup": ["./data/index.json"] },
};

export default nextConfig;
