import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use child processes instead of worker threads for builds.
  // Child processes release memory back to the OS when they exit,
  // which prevents OOM on memory-constrained containers (e.g. Railway 8 GB).
  experimental: {
    workerThreads: false,
  },
  // Skip TypeScript type-checking during `next build`.
  // The TS checker loads the entire project type-graph into a single process
  // and OOMs on memory-constrained containers. SWC/Turbopack still compiles
  // TypeScript correctly — this only skips the separate `tsc` validation pass.
  // Run `tsc --noEmit` in CI instead.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Note: eslint config removed — no longer supported in Next.js 16.
  // Run ESLint in CI instead.
};

export default nextConfig;
