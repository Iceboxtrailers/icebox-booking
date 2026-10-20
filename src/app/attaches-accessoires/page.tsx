import { MarketingLayout } from "@/components/MarketingLayout";
import { LeadContactForm } from "@/components/forms/LeadContactForm";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Attaches & accessoires — IceBox",
  path: "/attaches-accessoires",
  description: "Attaches de remorque, accessoires d'alimentation électrique et équipement complémentaire pour votre location IceBox : écrivez-nous, nous vous conseillerons.",
});

export default function AttachesAccessoiresPage() {
  return (
    <MarketingLayout>
      <h1 className="font-heading mb-3 text-2xl">Attaches & accessoires</h1>
      <p className="mb-6 max-w-2xl text-[15px] text-muted">
        Besoin d&apos;une attache de remorque, d&apos;un accessoire d&apos;alimentation électrique ou
        d&apos;équipement complémentaire pour votre location ? Écrivez-nous et nous vous conseillerons selon
        votre véhicule et vos besoins.
      </p>
      <div className="max-w-md">
        <LeadContactForm topic="Attaches & accessoires" />
      </div>
    </MarketingLayout>
  );
}
