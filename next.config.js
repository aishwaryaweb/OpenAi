/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    serverComponentsExternalPackages: ['@google/genai'],
  },
  webpack: (config) => {
    config.externals = config.externals || [];
    if (!config.externals.includes('bufferutil')) {
      config.externals.push('bufferutil');
    }
    if (!config.externals.includes('utf-8-validate')) {
      config.externals.push('utf-8-validate');
    }
    return config;
  },
};

module.exports = nextConfig;
