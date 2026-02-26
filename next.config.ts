import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use child processes instead of worker threads for builds.
  // Child processes release memory back to the OS when they exit,
  // which prevents OOM on memory-constrained containers (e.g. Railway 8 GB).
  experimental: {
    workerThreads: false,
  },
};

export default nextConfig;
