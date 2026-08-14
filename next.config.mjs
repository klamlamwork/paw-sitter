/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/shop/shops/:shop/p/:slug",
        destination: "/shop/p/:slug",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
