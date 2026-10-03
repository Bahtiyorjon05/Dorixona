import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ko'prik skriptlari saytdan beriladi (repo yopiq) — build'ga qo'shilsin
  outputFileTracingIncludes: {
    "/api/integrations/fapteka/skript/[name]": ["./scripts/fapteka-relay/*.ps1"],
  },
};

export default nextConfig;
