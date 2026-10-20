import type { Metadata } from "next";
import type { FaqItem } from "@/lib/faq";
import { siteUrl } from "@/lib/site";

export const SITE_TITLE = "IceBox — Location de remorques réfrigérées et congelées";
export const SITE_DESCRIPTION =
  "Louez une remorque réfrigérée ou congelée à Lévis (5×10 et 6×12) pour vos événements, votre commerce ou vos imprévus. Choisissez vos dates et réservez en ligne.";

// 1200 x 630: the format social networks and messaging apps show for a shared link.
const SOCIAL_IMAGE = { url: "/og-image.jpg", width: 1200, height: 630, alt: "Remorque réfrigérée IceBox 5×10" };

// Metadata of a public page. A page's "openGraph" replaces the layout's entirely instead of being
// merged with it, so everything a link preview needs is spelled out here, in one place.
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", locale: "fr_CA", siteName: "IceBox", title, description, url: path, images: [SOCIAL_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [SOCIAL_IMAGE.url] },
  };
}

// What search engines show next to the business (address, phone, logo). Facts already published on
// the site's own pages; nothing about prices or opening hours.
export function businessJsonLd() {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "IceBox",
    legalName: "Remorques Réfrigérées ICEBOX Inc.",
    description: SITE_DESCRIPTION,
    url: base,
    logo: `${base}/brand/logo-lockup.png`,
    image: `${base}${SOCIAL_IMAGE.url}`,
    telephone: "+1-581-889-2093",
    email: "info@iceboxtrailers.ca",
    address: {
      "@type": "PostalAddress",
      streetAddress: "1005 rue du Parc-Industriel",
      addressLocality: "Lévis",
      addressRegion: "QC",
      postalCode: "G6Z 1C5",
      addressCountry: "CA",
    },
    areaServed: { "@type": "AdministrativeArea", name: "Québec" },
  };
}

export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
