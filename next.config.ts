import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "ffmpeg-static", "ffprobe-static"],
  experimental: {
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
