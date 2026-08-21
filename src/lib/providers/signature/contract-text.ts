import { fmt, nights } from "@/lib/dates";
import { catalogueFor } from "@/lib/catalogue";
import { RATE_TABLE, TRANSPORT_FEE_PER_TRIP_CENTS } from "@/lib/pricing";
import type { TrailerSize } from "@/lib/constants";

// Company-side facts from the real IceBox rental contract template —
// legally significant, do not infer or alter these.
const LOCATEUR_NAME = "Remorques Réfrigérées ICEBOX";
const LOCATEUR_ADDRESS_LINE1 = "1005, rue du Parc-Industriel";
const LOCATEUR_ADDRESS_LINE2 = "Lévis (Québec) G6Z 1C5";
const ADDITIONAL_INSURED = "Remorques Réfrigérées ICEBOX Inc.";

// Per-size hardware specs from the real IceBox rental contract template —
// legally significant, do not infer or alter these.
type TrailerContractSpec = {
  essieux: number;
  dimensions: string; // "extérieures (intérieures)", matches the template's own convention
  mainDeRemorque: string;
  refrigerationLabel: string;
  refrigerationValue: string;
  equipements: string;
  thermostat: string;
};

const TRAILER_SPECS: Record<TrailerSize, TrailerContractSpec> = {
  "5x10": {
    essieux: 1,
    dimensions: "5' x 10' (52'' x 110'')",
    mainDeRemorque: "2''",
    refrigerationLabel: "Unité de réfrigération",
    refrigerationValue: "Commerciale (prise 120V, 15A)",
    equipements:
      "Rails pour suspension de viande, éclairage LED, drain de plancher, valve de décompression",
    thermostat: "Réglable manuellement",
  },
  "6x12": {
    essieux: 2,
    dimensions: "6'-6'' x 12' (70'' x 120'')",
    mainDeRemorque: "2 5/16''",
    refrigerationLabel: "Unité de réfrigération et congélation",
    refrigerationValue: "Prise standard 120V/15A",
    equipements:
      "Rails pour suspension de viande, éclairage LED, drain de plancher, valve de décompression, marche, pattes stabilisatrices, emplacement pour génératrice à l'avant",
    thermostat: "Réglable avant livraison",
  },
};

export type ContractLine =
  | { type: "title"; text: string }
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "body"; text: string }
  | { type: "spacer" };

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Shared by the PDF generator (stub.ts) and the on-screen contract preview,
// so both always show the exact same wording. Mirrors the real IceBox
// rental contract template — sizes 5x10 and 6x12 differ in interior
// dimensions, temperature range, and the three price tiers.
export function buildContractLines(p: {
  firstName: string;
  lastName: string;
  company: string | null;
  email: string;
  phone: string;
  trailerSize: TrailerSize;
  start: string;
  end: string;
  totalCents: number;
  usageLocation: string | null;
}): ContractLine[] {
  const n = nights(p.start, p.end);
  const catalogue = catalogueFor(p.trailerSize);
  const rate = RATE_TABLE[p.trailerSize];
  const spec = TRAILER_SPECS[p.trailerSize];
  const clientName = `${p.firstName} ${p.lastName}`;
  const lieuUtilisation = p.usageLocation?.trim() || "À préciser";

  const lines: ContractLine[] = [];
  const body = (text: string) => lines.push({ type: "body", text });
  const spacer = () => lines.push({ type: "spacer" });
  const heading = (text: string) => lines.push({ type: "heading", text });
  const subheading = (text: string) => lines.push({ type: "subheading", text });

  lines.push({ type: "title", text: "CONTRAT DE LOCATION – REMORQUES RÉFRIGÉRÉES ICEBOX" });
  spacer();

  body("Entre les parties :");
  subheading("Le Locateur :");
  body(LOCATEUR_NAME);
  body(LOCATEUR_ADDRESS_LINE1);
  body(LOCATEUR_ADDRESS_LINE2);
  spacer();
  subheading("Le Locataire :");
  body(clientName);
  if (p.company) body(p.company);
  body(`Téléphone : ${p.phone}`);
  body(`Courriel : ${p.email}`);
  spacer();

  heading("1. Objet de la Location");
  body(
    `Le Locateur loue au Locataire une remorque réfrigérée « ICEBOX » ${p.trailerSize}, à ${spec.essieux} essieu${spec.essieux > 1 ? "x" : ""}, avec les spécifications suivantes :`
  );
  body(`Dimensions extérieures (intérieures) : ${spec.dimensions}`);
  body(`Essieux : ${spec.essieux}`);
  body(`Main de remorque : ${spec.mainDeRemorque}`);
  body(`Plage de température : ${catalogue?.tempRangeLabel ?? "—"}`);
  body("Isolation : Panneaux métalliques (R-32)");
  body(`${spec.refrigerationLabel} : ${spec.refrigerationValue}`);
  body(`Équipements inclus : ${spec.equipements}`);
  body("Conformité : La remorque est conforme à la circulation routière.");
  body(`Thermostat : ${spec.thermostat}`);
  spacer();

  heading("2. Durée de la Location");
  body(`La location est accordée pour ${n} jour${n > 1 ? "s" : ""}, du ${fmt(p.start)} au ${fmt(p.end)}, inclusivement.`);
  spacer();

  heading("3. Lieu d'Utilisation");
  body(lieuUtilisation);
  spacer();

  heading("4. Conditions Financières");
  body("Le coût de location pour la remorque est de :");
  body(`${money(rate.dayCents)} $ +Tx CAD par jour;`);
  body(`${money(rate.weekCents)} $ +Tx CAD par semaine;`);
  body(`${money(rate.monthCents)} $ +Tx CAD par mois.`);
  body(`${money(TRANSPORT_FEE_PER_TRIP_CENTS)} $ / transport dans un rayon de 50 km du Locateur.`);
  body(`Montant estimé pour cette réservation : ${money(p.totalCents)} $ +Tx CAD, pour ${n} jour${n > 1 ? "s" : ""}.`);
  body("Le paiement total est exigible sur réception de la remorque.");
  spacer();

  heading("5. Responsabilités du Locataire");
  body("Le Locataire s'engage à :");
  body("Utiliser la remorque de manière appropriée et à maintenir son bon état de fonctionnement.");
  body("Informer le Locateur immédiatement en cas de bris, perte ou dommage.");
  body("Respecter toutes les lois en vigueur lors de l'utilisation de la remorque.");
  spacer();

  heading("6. Assurance");
  body("Le Locataire doit souscrire et maintenir en vigueur, pendant toute la durée de ce contrat :");
  body("Une assurance responsabilité civile automobile avec un montant minimal de 2 000 000 $.");
  body(
    "Une assurance responsabilité civile générale des entreprises couvrant l'utilisation de la remorque pour un montant minimal de 2 000 000 $."
  );
  spacer();
  subheading("Avenant F.A.Q. n° 27 – Dommages au Véhicule Loué");
  body(
    "Le Locataire doit inclure à sa police d'assurance automobile une garantie dans le cadre de l'avenant F.A.Q. n° 27, afin de couvrir tous les dommages matériels pouvant affecter la remorque louée."
  );
  subheading("Assuré Additionnel");
  body(`Le Locateur, ${ADDITIONAL_INSURED}, sera désigné comme assuré additionnel sur la police d'assurance du Locataire.`);
  subheading("Certificat d'Assurance Requis");
  body("Avant la prise de possession de la remorque, le Locataire devra fournir un certificat d'assurance confirmant :");
  body("La présence de la couverture F.A.Q. n° 27 et de la responsabilité civile avec les limites spécifiées.");
  body("L'identification du Locateur comme assuré additionnel.");
  body("Les dates de validité de la police.");
  body("La description détaillée de la remorque (marque, modèle et numéro de série).");
  spacer();

  heading("7. Retour des Équipements");
  body(
    "Le Locataire s'engage à retourner la remorque à l'adresse du Locateur. La remorque devra être restituée en bon état de propreté et de fonctionnement."
  );
  spacer();

  heading("8. Dispositions Générales");
  body(
    "Le présent contrat constitue l'intégralité de l'entente entre les parties. Aucune modification de ce contrat ne sera valable sans le consentement écrit mutuel des deux parties."
  );
  spacer();

  const today = new Date().toISOString().slice(0, 10);
  heading("Signatures");
  body(`Fait à Lévis, le ${fmt(today)}.`);
  spacer();
  subheading("Pour le Locateur :");
  body(LOCATEUR_NAME);
  spacer();
  subheading("Pour le Locataire :");
  body(clientName);

  return lines;
}

// Flat single-string fallback for contexts that just need the gist (not used
// by the PDF/preview, which render buildContractLines() directly).
export function buildContractText(p: Parameters<typeof buildContractLines>[0]): string {
  return buildContractLines(p)
    .filter((l) => l.type !== "spacer")
    .map((l) => l.text)
    .join(" ");
}
