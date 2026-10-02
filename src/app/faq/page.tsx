import { MarketingLayout } from "@/components/MarketingLayout";

export const metadata = { title: "FAQ — IceBox" };

const FAQ_ITEMS = [
  {
    q: "Dois-je créer un compte pour réserver ?",
    a: "Non. Vous pouvez réserver en donnant seulement votre nom, courriel et téléphone — aucun mot de passe requis.",
  },
  {
    q: "Quelles tailles de remorques offrez-vous ?",
    a: "Une 5x10 (2 °C à +15 °C), idéale pour petits volumes, événements et commerces, et une 6x12 (-18 °C à +15 °C), pour les grands volumes, événements, industries et distribution.",
  },
  {
    q: "Qu'est-ce que le dépôt de sécurité ?",
    a: "Un dépôt de 250 $ est autorisé sur votre carte au moment de la prise de possession — il n'est jamais débité à l'avance, seulement retenu, et il est remis après le retour de la remorque en bon état.",
  },
  {
    q: "Quels documents dois-je fournir ?",
    a: "Un permis de conduire et une preuve d'assurance. Vous pouvez aussi passer cette étape en ligne et la compléter en succursale.",
  },
  {
    q: "Quelle assurance dois-je avoir ?",
    a: "Une assurance responsabilité civile automobile et une assurance responsabilité civile générale des entreprises, chacune d'un minimum de 2 000 000 $, avec l'avenant F.A.Q. n° 27 pour les dommages au véhicule loué.",
  },
  {
    q: "Offrez-vous la livraison ?",
    a: "Oui — des frais de transport s'appliquent par trajet, avec un montant additionnel au kilomètre au-delà de 50 km du point de service.",
  },
  {
    q: "Comment puis-je payer ?",
    a: "En ligne par carte de crédit, Apple Pay ou Google Pay selon votre appareil.",
  },
  {
    q: "J'ai besoin d'une remorque aujourd'hui, que faire ?",
    a: "Appelez-nous directement — nous offrons un service d'urgence disponible 24/7 au 418 576-4147.",
  },
];

export default function FaqPage() {
  return (
    <MarketingLayout>
      <h1 className="font-heading mb-6 text-2xl">Questions fréquentes</h1>
      <div className="max-w-2xl space-y-5">
        {FAQ_ITEMS.map((item) => (
          <div key={item.q}>
            <div className="mb-1 text-[14px] font-medium">{item.q}</div>
            <div className="text-[13px] text-muted">{item.a}</div>
          </div>
        ))}
      </div>
    </MarketingLayout>
  );
}
