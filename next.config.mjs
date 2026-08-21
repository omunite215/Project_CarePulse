/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // `node-appwrite` is a server-only SDK. Keeping it external stops the bundler
  // from ever trying to trace it into a client or edge chunk.
  serverExternalPackages: ["node-appwrite"],

  images: {
    // Doctor avatars and hero art are local; remote patterns are only needed
    // when identification documents come back from Appwrite Storage.
    remotePatterns: process.env.NEXT_PUBLIC_ENDPOINT
      ? [
          {
            protocol: "https",
            hostname: new URL(process.env.NEXT_PUBLIC_ENDPOINT).hostname,
          },
        ]
      : [],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
