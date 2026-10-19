/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The email map picture is drawn with a native library; keep it out of the bundle.
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js"],
    // The spelling check reads its dictionary files from disk; make sure they ship with the route.
    outputFileTracingIncludes: { "/api/spellcheck": ["./lib/dict/**"] },
  },
};
export default nextConfig;
