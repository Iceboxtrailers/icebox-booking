import { MarketingLayout } from "@/components/MarketingLayout";
import { LeadContactForm } from "@/components/forms/LeadContactForm";

export const metadata = { title: "Devenir concessionnaire — IceBox" };

export default function DevenirConcessionnairePage() {
  return (
    <MarketingLayout>
      <h1 className="font-heading mb-3 text-2xl">Devenir concessionnaire</h1>
      <p className="mb-6 max-w-2xl text-[15px] text-muted">
        Vous exploitez une entreprise de location d&apos;équipement ou un commerce complémentaire et souhaitez
        offrir les remorques réfrigérées IceBox à votre clientèle ? Écrivez-nous pour en discuter — territoire,
        conditions et disponibilité de flotte.
      </p>
      <div className="max-w-md">
        <LeadContactForm topic="Devenir concessionnaire" />
      </div>
    </MarketingLayout>
  );
}
