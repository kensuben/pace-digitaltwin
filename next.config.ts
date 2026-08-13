import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Local development is normally opened via 127.0.0.1 while Next binds to
  // 0.0.0.0. Allow the loopback origin so the dev-only HMR WebSocket upgrade
  // is not rejected by Next's cross-origin protection.
  allowedDevOrigins: ["127.0.0.1"],
  // Next 16.3's CLI checker can emit non-JSON output before `--showConfig`
  // under the managed Node runtime. TypeScript 6 still exposes the compiler API.
  experimental: { useTypeScriptCli: false },
};

export default nextConfig;
