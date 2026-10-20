// Public base URL of the site, for links inside emails sent outside a request
// (Vercel exposes the production hostname without a protocol).
export function siteUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || "icebox-booking-master.vercel.app";
  return `https://${host}`;
}

// The site stays out of search engines until the owner says it is public. At launch, set
// SITE_INDEXABLE=1 in the hosting settings and redeploy: robots.txt, the sitemap and the
// "noindex" tags all follow this one switch.
export function indexingAllowed(): boolean {
  return process.env.SITE_INDEXABLE === "1";
}
