import { MarketingLayout } from "@/components/MarketingLayout";
import { Hero } from "@/components/Hero";
import { ModelsSection } from "@/components/home/ModelsSection";
import { InteriorSection } from "@/components/home/InteriorSection";
import { HowItWorks } from "@/components/home/HowItWorks";
import { FaqHighlights } from "@/components/home/FaqHighlights";
import { OtherServices } from "@/components/home/OtherServices";
import { buttonClassName } from "@/components/ui/Button";
import { JsonLd } from "@/components/JsonLd";
import { SITE_DESCRIPTION, SITE_TITLE, businessJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: "/" });

// Order of the page: what you can rent and for which need (hero + models + interior),
// how it works, the questions that can block a booking, then the quieter secondary services.
export default function HomePage() {
  return (
    <MarketingLayout>
      <JsonLd data={businessJsonLd()} />
      <Hero />
      <ModelsSection />
      <InteriorSection />
      <HowItWorks />
      <FaqHighlights />

      <section className="mb-14 flex flex-col items-center justify-between gap-3 rounded-xl border border-warn-line bg-warn-soft p-5 text-center sm:flex-row sm:text-left">
        <div>
          <div className="text-[15px] font-semibold">🚨 Besoin d&apos;une remorque aujourd&apos;hui ?</div>
          <div className="text-[13px] text-muted">Service d&apos;urgence disponible 24/7.</div>
        </div>
        <a href="tel:+15818892093" className={buttonClassName("cta", "md", "shrink-0")}>
          Appelez-nous → 581 889-2093
        </a>
      </section>

      <OtherServices />
    </MarketingLayout>
  );
}
