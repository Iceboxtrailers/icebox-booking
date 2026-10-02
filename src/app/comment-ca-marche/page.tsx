import Link from "next/link";
import { MarketingLayout } from "@/components/MarketingLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Comment ça marche — IceBox" };

const STEPS = [
  {
    title: "Dates et lieu",
    text: "Indiquez vos dates de ramassage et de retour, et où la remorque sera utilisée.",
  },
  {
    title: "Choix de la remorque",
    text: "On vous montre les remorques réellement disponibles pour ces dates, avec le prix déjà calculé.",
  },
  {
    title: "Documents",
    text: "Permis de conduire et preuve d'assurance — ou passez cette étape et complétez-la en succursale.",
  },
  {
    title: "Contrat",
    text: "Le contrat de location se génère automatiquement avec vos informations ; signez-le à l'écran.",
  },
  {
    title: "Dépôt de sécurité",
    text: "Un dépôt est autorisé sur votre carte (jamais débité à l'avance) et remis après le retour de la remorque.",
  },
  {
    title: "Confirmation",
    text: "Vous recevez la confirmation de votre réservation — plus besoin d'appeler ou d'attendre un courriel.",
  },
];

export default function CommentCaMarchePage() {
  return (
    <MarketingLayout>
      <h1 className="font-heading mb-3 text-2xl">Comment ça marche</h1>
      <p className="mb-8 max-w-2xl text-[15px] text-muted">
        Toute la réservation se fait en ligne, sans appel ni va-et-vient de courriels — et sans avoir à créer de
        compte.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <Card key={step.title} className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E4EEF4] text-[12px] font-medium text-navy">
                {i + 1}
              </span>
              <span className="text-sm font-medium">{step.title}</span>
            </div>
            <div className="pl-8 text-[13px] text-muted">{step.text}</div>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Link href="/reservation/invite">
          <Button variant="cta">Commencer ma réservation</Button>
        </Link>
      </div>
    </MarketingLayout>
  );
}
