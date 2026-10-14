import { MarketingLayout } from "@/components/MarketingLayout";

export const metadata = { title: "Politique de confidentialité — IceBox" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Qui sommes-nous",
    body: [
      "Remorques Réfrigérées ICEBOX Inc. (« IceBox »), 1005 rue du Parc-Industriel, Lévis (Québec) G6Z 1C5, loue des remorques réfrigérées et congelées. Cette politique explique quels renseignements personnels nous recueillons par ce site, pourquoi, et comment nous les protégeons, conformément à la Loi sur la protection des renseignements personnels dans le secteur privé (Québec) et à la Loi 25.",
    ],
  },
  {
    title: "2. Renseignements recueillis",
    body: [
      "Identité et coordonnées : prénom, nom, entreprise, courriel, téléphone, adresse de facturation.",
      "Location : remorque et dates demandées, adresse de livraison ou d'utilisation, montants, historique de vos réservations.",
      "Documents : permis de conduire et preuve d'assurance, que vous nous transmettez avec votre consentement explicite.",
      "Contrat : votre nom de signataire, votre signature électronique, la date et l'adresse IP au moment de la signature.",
      "Paiement : votre carte est saisie directement chez notre fournisseur de paiement (Stripe). IceBox ne voit ni ne conserve votre numéro de carte complet.",
      "Compte : votre mot de passe est conservé sous forme chiffrée irréversible.",
    ],
  },
  {
    title: "3. Pourquoi nous les utilisons",
    body: [
      "Pour traiter votre réservation, préparer et conserver votre contrat de location, vérifier votre admissibilité à la location, retenir et libérer le dépôt de sécurité, organiser la livraison et la récupération, facturer, tenir notre comptabilité, répondre à vos questions et respecter nos obligations légales et fiscales. Nous n'utilisons pas vos renseignements pour de la publicité de tiers et nous ne les vendons pas.",
    ],
  },
  {
    title: "4. Avec qui nous les partageons",
    body: [
      "Nous faisons appel à des fournisseurs qui traitent des renseignements pour notre compte, uniquement pour fournir le service : Stripe (paiements et dépôts de sécurité), Vercel (hébergement du site et stockage privé de fichiers), Neon (base de données), Intuit QuickBooks (comptabilité et facturation), Google (calcul de la distance de livraison à partir de l'adresse fournie) et Microsoft (courriel d'entreprise).",
      "Certains de ces fournisseurs peuvent traiter les renseignements à l'extérieur du Québec, notamment aux États-Unis. Nous nous assurons qu'ils offrent des mesures de protection adéquates. Nous pouvons aussi communiquer des renseignements lorsque la loi l'exige.",
    ],
  },
  {
    title: "5. Conservation",
    body: [
      "Nous conservons vos renseignements aussi longtemps que nécessaire pour les fins décrites ci-dessus et pour respecter les délais de conservation prévus par les lois fiscales et comptables, puis nous les détruisons ou les anonymisons de façon sécuritaire.",
    ],
  },
  {
    title: "6. Sécurité",
    body: [
      "Les échanges avec le site sont chiffrés (HTTPS). Les documents d'identité sont stockés dans un espace privé accessible uniquement au personnel autorisé. L'accès à la console de gestion est protégé par des comptes individuels et des droits limités selon le rôle. Les actions financières sont consignées dans un journal d'audit.",
    ],
  },
  {
    title: "7. Vos droits",
    body: [
      "Vous pouvez demander l'accès à vos renseignements, leur rectification, leur retrait (sous réserve de nos obligations légales de conservation), retirer votre consentement ou nous poser une question sur nos pratiques. Écrivez-nous à info@iceboxtrailers.ca; nous répondrons dans un délai de 30 jours. Vous pouvez aussi déposer une plainte auprès de la Commission d'accès à l'information du Québec.",
    ],
  },
  {
    title: "8. Responsable de la protection des renseignements personnels",
    body: [
      "Frédéric Garnaud, propriétaire — info@iceboxtrailers.ca — 581 889-2093.",
    ],
  },
  {
    title: "9. Modifications",
    body: [
      "Nous pouvons mettre à jour cette politique. La date de dernière mise à jour figure ci-dessous; la version publiée sur ce site est la version en vigueur.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <h1 className="font-heading mb-2 text-2xl">Politique de confidentialité</h1>
      <p className="mb-6 text-[12px] text-muted">Dernière mise à jour : 14 octobre 2026</p>
      <div className="max-w-2xl space-y-6 text-[14px] leading-relaxed text-foreground">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 text-[15px] font-medium">{section.title}</h2>
            <div className="space-y-2 text-muted">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </MarketingLayout>
  );
}
