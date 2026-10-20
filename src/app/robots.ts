import type { MetadataRoute } from "next";
import { indexingAllowed, siteUrl } from "@/lib/site";

// Closed to every crawler until SITE_INDEXABLE=1 (see src/lib/site.ts). Once open, only the public
// pages are offered: booking, account, console and API stay out.
export default function robots(): MetadataRoute.Robots {
  if (!indexingAllowed()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/admin",
        "/compte",
        "/reservation/",
        "/depot/",
        "/login",
        "/signup",
        "/mot-de-passe-oublie",
        "/reinitialiser-mot-de-passe",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
