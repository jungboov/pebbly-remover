import type { NextConfig } from "next";

// 정적 파일로 내보냄(out/) — Cloudflare Pages가 그대로 올림
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  turbopack: { root: __dirname },
};

export default nextConfig;
