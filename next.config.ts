import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  sassOptions: {
    additionalData: `
    @use "@/assets/styles/mixins" as *;
    @use "@/assets/styles/variables" as *;
  `,
  },
};

export default nextConfig;
