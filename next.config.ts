/** @type {import('next').NextConfig} */
const nextConfig = {
  // Le mode 'export' est désactivé pour permettre les Server Actions et le rendu dynamique
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
