import { fmt, nights, quebecDay } from "@/lib/dates";
import { catalogueFor } from "@/lib/catalogue";
import { RATE_TABLE, TRANSPORT_FEE_PER_TRIP_CENTS, computeTaxBreakdown } from "@/lib/pricing";
import { DELIVERY_OPTION_LABEL_FR, DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";
import type { DeliveryOption, TrailerSize } from "@/lib/constants";

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
  | { type: "bullet"; text: string }
  | { type: "rule" }
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
  billingAddress?: string | null;
  billingCity?: string | null;
  billingProvince?: string | null;
  billingPostalCode?: string | null;
  trailerSize: TrailerSize;
  start: string;
  end: string;
  totalCents: number;
  usageLocation: string | null;
  // How the trailer gets to the client and back. Absent or "pickup": the client comes to the depot both ways and
  // the wording is exactly what it was before delivery existed. `deliveryFeeCents` is part of `totalCents`.
  deliveryOption?: DeliveryOption;
  deliveryFeeCents?: number;
}): ContractLine[] {
  const n = nights(p.start, p.end);
  const catalogue = catalogueFor(p.trailerSize);
  const rate = RATE_TABLE[p.trailerSize];
  const spec = TRAILER_SPECS[p.trailerSize];
  const clientName = `${p.firstName} ${p.lastName}`;
  const lieuUtilisation = p.usageLocation?.trim() || "À préciser";
  const delivery = p.deliveryOption ?? "pickup";
  const transportCents = delivery === "pickup" ? 0 : Math.min(Math.max(p.deliveryFeeCents ?? 0, 0), p.totalCents);
  const cityLine = [p.billingCity, p.billingProvince].filter(Boolean).join(", ");
  const cityPostalLine = [cityLine, p.billingPostalCode].filter(Boolean).join(" ");

  const lines: ContractLine[] = [];
  const body = (text: string) => lines.push({ type: "body", text });
  const bullet = (text: string) => lines.push({ type: "bullet", text });
  const rule = () => lines.push({ type: "rule" });
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
  if (p.billingAddress) body(p.billingAddress);
  if (cityPostalLine) body(cityPostalLine);
  body(`Téléphone : ${p.phone}`);
  body(`Courriel : ${p.email}`);
  spacer();

  heading("1. Objet de la Location");
  body(
    `Le Locateur loue au Locataire une remorque réfrigérée « ICEBOX » ${p.trailerSize}, à ${spec.essieux} essieu${spec.essieux > 1 ? "x" : ""}, avec les spécifications suivantes :`
  );
  bullet(`Dimensions extérieures (intérieures) : ${spec.dimensions}`);
  bullet(`Essieux : ${spec.essieux}`);
  bullet(`Main de remorque : ${spec.mainDeRemorque}`);
  bullet(`Plage de température : ${catalogue?.tempRangeLabel ?? "—"}`);
  bullet("Isolation : Panneaux métalliques (R-32)");
  bullet(`${spec.refrigerationLabel} : ${spec.refrigerationValue}`);
  bullet(`Équipements inclus : ${spec.equipements}`);
  bullet("Conformité : La remorque est conforme à la circulation routière.");
  bullet(`Thermostat : ${spec.thermostat}`);
  spacer();
  rule();

  heading("2. Durée de la Location");
  body(`La location est accordée pour ${n} jour${n > 1 ? "s" : ""}, du ${fmt(p.start)} au ${fmt(p.end)}, inclusivement.`);
  spacer();
  rule();

  heading("3. Lieu d'Utilisation");
  body(lieuUtilisation);
  const livraison = `Livraison : le Locateur livre la remorque à cette adresse le ${fmt(p.start)}.`;
  const recuperation = `Récupération : le Locateur reprend la remorque à cette adresse le ${fmt(p.end)}.`;
  if (delivery === "delivery") {
    bullet(livraison);
    bullet(recuperation);
  } else if (delivery === "delivery_only") {
    bullet(livraison);
    bullet(`Retour : le Locataire rapporte la remorque à l'adresse du Locateur le ${fmt(p.end)}.`);
  } else if (delivery === "return_only") {
    bullet(`Ramassage : le Locataire prend possession de la remorque à l'adresse du Locateur le ${fmt(p.start)}.`);
    bullet(recuperation);
  }
  spacer();
  rule();

  const tax = computeTaxBreakdown(p.totalCents);

  heading("4. Conditions Financières");
  body("Le coût de location pour la remorque est de :");
  bullet(`${money(rate.dayCents)} $ +Tx CAD par jour;`);
  bullet(`${money(rate.weekCents)} $ +Tx CAD par semaine;`);
  bullet(`${money(rate.monthCents)} $ +Tx CAD par mois.`);
  bullet(`${money(TRANSPORT_FEE_PER_TRIP_CENTS)} $ / transport dans un rayon de 50 km du Locateur.`);
  body(`Montant pour cette réservation (${n} jour${n > 1 ? "s" : ""}) :`);
  if (delivery !== "pickup") {
    bullet(`Location : ${money(p.totalCents - transportCents)} $ CAD`);
    bullet(`Transport (${DELIVERY_OPTION_LABEL_FR[delivery].toLowerCase()}) : ${money(transportCents)} $ CAD`);
  }
  bullet(`Sous-total : ${money(tax.subtotalCents)} $ CAD`);
  bullet(`TPS (5%) : ${money(tax.gstCents)} $`);
  bullet(`TVQ (9,975%) : ${money(tax.qstCents)} $`);
  bullet(`Total : ${money(tax.totalWithTaxCents)} $ CAD`);
  body("Le paiement total est exigible sur réception de la remorque.");
  spacer();
  rule();

  heading("5. Dépôt de garantie");
  body(
    "Le Locataire fournit, lors de la réservation, une carte de crédit valide. La carte est enregistrée de façon sécurisée par le prestataire de paiement du Locateur; le Locateur ne conserve pas le numéro de la carte."
  );
  bullet(
    `Avant la remise de la remorque, le Locateur place sur cette carte une retenue (préautorisation) de ${money(DEPOSIT_AMOUNT_CENTS)} $ CAD à titre de dépôt de garantie. Il ne s'agit pas d'un prélèvement : le montant est réservé sur la limite de crédit du Locataire.`
  );
  bullet(
    "Le Locataire autorise le Locateur à placer cette retenue et à la renouveler au besoin pendant la durée de la location, une préautorisation expirant normalement après environ sept (7) jours."
  );
  bullet(
    "Après le retour de la remorque et son inspection, si celle-ci est acceptée sans dommage ni somme due, le Locateur libère la retenue. Le délai avant que le montant redevienne disponible dépend de l'émetteur de la carte."
  );
  bullet(
    `Le Locateur peut prélever sur le dépôt, jusqu'à concurrence de ${money(DEPOSIT_AMOUNT_CENTS)} $ CAD, les sommes dues en raison de dommages, du bris ou de la perte de la remorque ou de ses équipements, d'un nettoyage excessif ou de tout montant impayé au titre du présent contrat. L'état de la remorque au retour est documenté par photos et le Locataire en est informé.`
  );
  bullet(
    "Le dépôt ne limite pas la responsabilité du Locataire et ne remplace pas l'assurance exigée à l'article 7. Si les dommages excèdent le dépôt, le Locataire demeure responsable de la différence."
  );
  spacer();
  rule();

  heading("6. Responsabilités du Locataire");
  body("Le Locataire s'engage à :");
  bullet("Utiliser la remorque de manière appropriée et à maintenir son bon état de fonctionnement.");
  bullet("Informer le Locateur immédiatement en cas de bris, perte ou dommage.");
  bullet("Respecter toutes les lois en vigueur lors de l'utilisation de la remorque.");
  spacer();
  rule();

  heading("7. Assurance");
  body("Le Locataire doit souscrire et maintenir en vigueur, pendant toute la durée de ce contrat :");
  bullet("Une assurance responsabilité civile automobile avec un montant minimal de 2 000 000 $.");
  bullet(
    "Une assurance responsabilité civile générale des entreprises couvrant l'utilisation de la remorque pour un montant minimal de 2 000 000 $."
  );
  spacer();
  subheading("Avenant F.A.Q. n° 27 – Dommages au Véhicule Loué");
  body(
    "Le Locataire doit inclure à sa police d'assurance automobile une garantie dans le cadre de l'avenant F.A.Q. n° 27, afin de couvrir tous les dommages matériels pouvant affecter la remorque louée."
  );
  subheading("Assuré Additionnel");
  body(`Le Locateur, ${ADDITIONAL_INSURED}, sera désigné comme assuré additionnel sur la police d'assurance du Locataire.`);
  spacer();
  subheading("Certificat d'Assurance Requis");
  body("Avant la prise de possession de la remorque, le Locataire devra fournir un certificat d'assurance confirmant :");
  bullet("La présence de la couverture F.A.Q. n° 27 et de la responsabilité civile avec les limites spécifiées.");
  bullet("L'identification du Locateur comme assuré additionnel.");
  bullet("Les dates de validité de la police.");
  bullet("La description détaillée de la remorque (marque, modèle et numéro de série).");
  spacer();
  rule();

  heading("8. Retour des Équipements");
  if (delivery === "delivery" || delivery === "return_only") {
    body(
      "À la fin de la location, le Locateur récupère la remorque à l'adresse indiquée à l'article 3, à la date prévue. Le Locataire s'engage à la rendre accessible et à la restituer en bon état de propreté et de fonctionnement."
    );
  } else {
    body(
      "Le Locataire s'engage à retourner la remorque à l'adresse du Locateur. La remorque devra être restituée en bon état de propreté et de fonctionnement."
    );
  }
  spacer();
  rule();

  heading("9. Dispositions Générales");
  body(
    "Le présent contrat constitue l'intégralité de l'entente entre les parties. Aucune modification de ce contrat ne sera valable sans le consentement écrit mutuel des deux parties."
  );
  spacer();
  rule();

  // The contract is dated with the Québec day (toISOString would give tomorrow's date after 8 pm).
  const today = quebecDay();
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

// The contract of a stored booking. The PDF (stub.ts) and the page the client signs on both go through this, so
// they cannot drift apart.
export function contractParamsFor(reservation: {
  client: {
    firstName: string;
    lastName: string;
    company: string | null;
    email: string;
    phone: string;
    billingAddress: string | null;
    billingCity: string | null;
    billingProvince: string | null;
    billingPostalCode: string | null;
  };
  trailer: { size: string };
  pickupDate: Date;
  returnDate: Date;
  totalAmount: number;
  usageLocation: string | null;
  deliveryOption: string;
  deliveryFeeCents: number;
}): Parameters<typeof buildContractLines>[0] {
  const { client } = reservation;
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    company: client.company,
    email: client.email,
    phone: client.phone,
    billingAddress: client.billingAddress,
    billingCity: client.billingCity,
    billingProvince: client.billingProvince,
    billingPostalCode: client.billingPostalCode,
    trailerSize: reservation.trailer.size as TrailerSize,
    start: reservation.pickupDate.toISOString().slice(0, 10),
    end: reservation.returnDate.toISOString().slice(0, 10),
    totalCents: reservation.totalAmount,
    usageLocation: reservation.usageLocation,
    deliveryOption: reservation.deliveryOption as DeliveryOption,
    deliveryFeeCents: reservation.deliveryFeeCents,
  };
}

// Flat single-string fallback for contexts that just need the gist (not used
// by the PDF/preview, which render buildContractLines() directly).
export function buildContractText(p: Parameters<typeof buildContractLines>[0]): string {
  return buildContractLines(p)
    .filter((l): l is Exclude<ContractLine, { type: "spacer" | "rule" }> => l.type !== "spacer" && l.type !== "rule")
    .map((l) => l.text)
    .join(" ");
}
