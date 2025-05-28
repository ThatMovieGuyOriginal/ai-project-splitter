/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['@babel/parser', '@babel/traverse']
  },
  webpack: (config, { isServer, dev }) => {
    // Client-side polyfills
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        events: false,
      };
    }

    // Handle specific modules that might cause issues
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        'ml-matrix': 'commonjs ml-matrix',
        'd3': 'commonjs d3',
        'yauzl': 'commonjs yauzl',
        'adm-zip': 'commonjs adm-zip'
      });
    }

    // Optimize builds
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 20
            },
            d3: {
              test: /[\\/]node_modules[\\/]d3[\\/]/,
              name: 'd3',
              chunks: 'all',
              priority: 30
            }
          }
        }
      };
    }

    return config;
  },
  env: {
    CUSTOM_KEY: process.env.VERCEL_ENV || 'development',
  },
  images: {
    domains: ['github.com', 'avatars.githubusercontent.com'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
  // Add TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  }
};

module.exports = nextConfig;
