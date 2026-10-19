/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The email map picture is drawn with a native library; keep it out of the bundle.
  experimental: { serverComponentsExternalPackages: ["@resvg/resvg-js"] },
};
export default nextConfig;
