import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The site never uses the microphone or the location; the camera only through the
          // phone's own photo picker.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      {
        // No other site can show ours inside a frame (clickjacking). Stored files are left out:
        // they open in the browser's own viewer, which a frame rule can get in the way of.
        source: "/((?!api/files/).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'" }],
      },
    ];
  },
};

export default nextConfig;
