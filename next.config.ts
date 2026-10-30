import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  serverExternalPackages: ["pg", "mmpay-node-sdk"],
};

export default nextConfig;
