// Public base URL of the site, for links inside emails sent outside a request
// (Vercel exposes the production hostname without a protocol).
export function siteUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || "icebox-booking-master.vercel.app";
  return `https://${host}`;
}
