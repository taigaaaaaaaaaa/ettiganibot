const nextConfig = {
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" } : {}),
  poweredByHeader: false,
};

export default nextConfig;
