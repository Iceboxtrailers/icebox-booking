import { MarketingLayout } from "@/components/MarketingLayout";
import { LeadContactForm } from "@/components/forms/LeadContactForm";

export const metadata = { title: "Attaches & accessoires — IceBox" };

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
