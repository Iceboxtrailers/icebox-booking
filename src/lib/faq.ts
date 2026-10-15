// Shared by the FAQ page (all questions) and the home page (the ones marked `home`,
// i.e. the questions that can stop someone from booking).
export type FaqItem = { q: string; a: string; home?: boolean };

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Dois-je créer un compte pour réserver ?",
    a: "Non. Vous pouvez réserver en donnant seulement votre nom, courriel et téléphone — aucun mot de passe requis.",
    home: true,
  },
  {
    q: "Quelles tailles de remorques offrez-vous ?",
    a: "Une 5x10 (2 °C à +15 °C), idéale pour petits volumes, événements et commerces, et une 6x12 (-18 °C à +15 °C), pour les grands volumes, événements, industries et distribution.",
  },
  {
    q: "Quel véhicule peut tirer la remorque ?",
    a: "La 5x10 pèse environ 1 800 lb et a une main de remorque de 2 po. La 6x12 pèse environ 2 400 lb et a une main de remorque de 2 5/16 po. Vérifiez la capacité de remorquage de votre véhicule dans son manuel. En cas de doute, appelez-nous ou demandez la livraison.",
    home: true,
  },
  {
    q: "Comment alimenter la remorque ?",
    a: "Elle se branche sur une prise 120 V; un câble d'alimentation de 50 pi est inclus. La remorque comprend aussi un support pour génératrice, et une génératrice est offerte en option.",
  },
  {
    q: "Qu'est-ce que le dépôt de sécurité ?",
    a: "Vous enregistrez votre carte à la réservation (rien n'est débité). Un dépôt de 1 000 $ est ensuite retenu sur cette carte juste avant la remise de la remorque — il n'est jamais débité, seulement retenu, et il est libéré après l'inspection du retour. Pour les locations de plus de 7 jours, la retenue peut devoir être renouvelée.",
    home: true,
  },
  {
    q: "Quels documents dois-je fournir ?",
    a: "Un permis de conduire et une preuve d'assurance. Vous pouvez aussi passer cette étape en ligne et la compléter en succursale.",
    home: true,
  },
  {
    q: "Quelle assurance dois-je avoir ?",
    a: "Une assurance responsabilité civile automobile et une assurance responsabilité civile générale des entreprises, chacune d'un minimum de 2 000 000 $, avec l'avenant F.A.Q. n° 27 pour les dommages au véhicule loué.",
    home: true,
  },
  {
    q: "Offrez-vous la livraison ?",
    a: "Oui — des frais de transport s'appliquent par trajet, avec un montant additionnel au kilomètre au-delà de 50 km du point de service.",
    home: true,
  },
  {
    q: "Comment puis-je payer ?",
    a: "En ligne par carte de crédit, Apple Pay ou Google Pay selon votre appareil.",
  },
  {
    q: "J'ai besoin d'une remorque aujourd'hui, que faire ?",
    a: "Appelez-nous directement — nous offrons un service d'urgence disponible 24/7 au 581 889-2093.",
  },
];
