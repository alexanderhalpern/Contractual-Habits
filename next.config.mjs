/** @type {import('next').NextConfig} */
const nextConfig = {
  // disable eslint
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
