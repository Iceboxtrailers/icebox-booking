import type { Metadata, Viewport } from "next";
import { BRAND } from "@/lib/brand";

// Shared by /dashboard and /admin/login so "Add to Home Screen" picks up the
// admin-specific manifest/icon regardless of which of the two pages the
// admin happens to be on when they install it (middleware bounces a
// logged-out /dashboard visit to /admin/login before layout.tsx ever runs).
export const adminPwaMetadata: Metadata = {
  title: "IceBox Admin",
  manifest: "/dashboard.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IceBox Admin",
  },
  icons: {
    apple: "/brand/apple-touch-icon.png",
  },
};

export const adminPwaViewport: Viewport = {
  themeColor: BRAND.navy,
};
