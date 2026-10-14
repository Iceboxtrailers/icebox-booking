import Link from "next/link";
import { MarketingLayout } from "@/components/MarketingLayout";

export const metadata = { title: "Conditions d'utilisation — IceBox" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Objet",
    body: [
      "Ces conditions encadrent l'utilisation du site et de la plateforme de réservation de Remorques Réfrigérées ICEBOX Inc. (« IceBox »), 1005 rue du Parc-Industriel, Lévis (Québec) G6Z 1C5. En réservant ou en créant un compte, vous acceptez ces conditions.",
    ],
  },
  {
    title: "2. Réservation et contrat de location",
    body: [
      "Une réservation en ligne devient ferme lorsqu'elle est confirmée par IceBox. La location elle-même est régie par le contrat de location que vous signez électroniquement : en cas de divergence, le contrat de location prévaut sur ces conditions. Les conditions propres à la location (durée, utilisation, retour, annulation, dommages et retards) sont celles du contrat.",
      "Vous devez fournir des renseignements exacts et à jour, ainsi que les documents demandés (permis de conduire et preuve d'assurance), ou les présenter en succursale avant la remise de la remorque.",
    ],
  },
  {
    title: "3. Prix, transport et taxes",
    body: [
      "Les prix affichés sont en dollars canadiens. Les frais de transport (livraison et récupération) sont calculés selon la distance depuis notre dépôt de Lévis. Les taxes applicables sont ajoutées lorsque requis par la loi. Des frais supplémentaires peuvent s'appliquer en cas de dommages, de nettoyage nécessaire ou de retard, comme prévu au contrat.",
    ],
  },
  {
    title: "4. Dépôt de sécurité",
    body: [
      "Vous enregistrez une carte à la réservation; aucun montant n'est débité à ce moment. Un dépôt de sécurité de 1 000 $ est ensuite retenu sur cette carte (une préautorisation) juste avant la remise de la remorque. Il n'est pas encaissé si la remorque est retournée conforme aux conditions du contrat, et la retenue est alors libérée après l'inspection du retour; le délai d'affichage de la libération dépend de votre banque.",
      "En cas de dommage, de perte ou de manquement au contrat, IceBox peut prélever sur le dépôt les montants dus, jusqu'à concurrence du dépôt. Une retenue de carte expire après un certain délai fixé par les banques; pour les locations de plus de sept jours, IceBox peut devoir la renouveler et vous demander de la confirmer.",
    ],
  },
  {
    title: "5. Votre compte",
    body: [
      "Vous êtes responsable de la confidentialité de votre mot de passe et des actions faites avec votre compte. Avertissez-nous sans délai de toute utilisation non autorisée. Nous pouvons suspendre un compte en cas d'utilisation frauduleuse ou contraire à ces conditions.",
    ],
  },
  {
    title: "6. Utilisation acceptable",
    body: [
      "Il est interdit d'utiliser le site pour une activité illégale, de tenter d'en perturber le fonctionnement, d'accéder à des données qui ne vous appartiennent pas ou de fournir de faux renseignements.",
    ],
  },
  {
    title: "7. Disponibilité et responsabilité",
    body: [
      "Nous faisons un effort raisonnable pour que le site soit disponible et exact, sans garantir qu'il soit exempt d'interruption ou d'erreur. Dans la mesure permise par la loi, IceBox n'est pas responsable des dommages indirects découlant de l'utilisation du site. Rien dans ces conditions ne limite les droits que la loi vous reconnaît en tant que consommateur.",
    ],
  },
  {
    title: "8. Renseignements personnels",
    body: [],
  },
  {
    title: "9. Droit applicable",
    body: [
      "Ces conditions sont régies par les lois du Québec et du Canada qui y sont applicables. Les tribunaux du Québec, district de Québec, ont compétence, sous réserve des droits que la loi accorde au consommateur.",
    ],
  },
  {
    title: "10. Nous joindre",
    body: ["info@iceboxtrailers.ca — 581 889-2093 — 1005 rue du Parc-Industriel, Lévis (Québec) G6Z 1C5."],
  },
];

export default function TermsPage() {
  return (
    <MarketingLayout>
      <h1 className="font-heading mb-2 text-2xl">Conditions d&apos;utilisation</h1>
      <p className="mb-6 text-[12px] text-muted">Dernière mise à jour : 14 octobre 2026</p>
      <div className="max-w-2xl space-y-6 text-[14px] leading-relaxed text-foreground">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 text-[15px] font-medium">{section.title}</h2>
            <div className="space-y-2 text-muted">
              {section.title.startsWith("8.") ? (
                <p>
                  Le traitement de vos renseignements personnels est décrit dans notre{" "}
                  <Link href="/confidentialite" className="text-navy underline">
                    politique de confidentialité
                  </Link>
                  .
                </p>
              ) : (
                section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
              )}
            </div>
          </section>
        ))}
      </div>
    </MarketingLayout>
  );
}
