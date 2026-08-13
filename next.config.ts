import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Next 16.3's CLI checker can emit non-JSON output before `--showConfig`
  // under the managed Node runtime. TypeScript 6 still exposes the compiler API.
  experimental: { useTypeScriptCli: false },
};

export default nextConfig;
