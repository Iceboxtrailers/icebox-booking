import { MarketingLayout } from "@/components/MarketingLayout";
import { LeadContactForm } from "@/components/forms/LeadContactForm";

export const metadata = { title: "Chambre froide sur mesure — IceBox" };

export default function ChambreFroidePage() {
  return (
    <MarketingLayout>
      <h1 className="font-heading mb-3 text-2xl">Chambre froide sur mesure</h1>
      <p className="mb-2 max-w-2xl text-[15px] text-muted">
        En plus de la location de remorques, IceBox conçoit des chambres froides sur mesure, installées à
        demeure — souvent à l&apos;intérieur de restaurants et de commerces alimentaires.
      </p>
      <p className="mb-6 max-w-2xl text-[13px] text-muted">
        Ce service est distinct de la location de remorques en ligne : il s&apos;agit d&apos;un projet
        d&apos;installation personnalisé. Décrivez-nous votre besoin ci-dessous et notre équipe vous contactera
        pour une soumission.
      </p>
      <div className="max-w-md">
        <LeadContactForm topic="Chambre froide sur mesure" />
      </div>
    </MarketingLayout>
  );
}
