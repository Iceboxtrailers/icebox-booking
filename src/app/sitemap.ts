import type { MetadataRoute } from "next";
import { indexingAllowed, siteUrl } from "@/lib/site";

// The public pages, by importance. Empty while the site is closed to search engines.
const PAGES: [path: string, priority: number][] = [
  ["/", 1],
  ["/comment-ca-marche", 0.8],
  ["/faq", 0.8],
  ["/contact", 0.7],
  ["/chambre-froide", 0.5],
  ["/chambre-congelation", 0.5],
  ["/attaches-accessoires", 0.5],
  ["/devenir-concessionnaire", 0.4],
  ["/conditions", 0.2],
  ["/confidentialite", 0.2],
];

export default function sitemap(): MetadataRoute.Sitemap {
  if (!indexingAllowed()) return [];
  const base = siteUrl();
  return PAGES.map(([path, priority]) => ({ url: `${base}${path}`, changeFrequency: "monthly", priority }));
}
