import { fmt, nights } from "@/lib/dates";
import { catalogueFor } from "@/lib/catalogue";
import { computeTaxBreakdown } from "@/lib/pricing";
import { DELIVERY_OPTION_LABEL_FR, DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";
import type { DeliveryOption, TrailerSize } from "@/lib/constants";

// Company-side facts from the owner's revised rental contract (27 October 2026) —
// legally significant, do not infer or alter these.
const LOCATEUR_NAME = "Remorques Réfrigérées ICEBOX Inc.";
const LOCATEUR_ADDRESS_LINE1 = "1005, rue du Parc-Industriel";
const LOCATEUR_ADDRESS_LINE2 = "Lévis (Québec) G6Z 1C5";

// The date of the contract template, printed on its first page.
export const CONTRACT_VERSION_DATE = "27 octobre 2026";

// The contract is set on this many pages ("les cinq pages du présent contrat"); a layout that needs another number
// has the text built again with it (stub.ts).
export const CONTRACT_PAGE_COUNT = 5;

// The Locateur's tax registration numbers, printed under the amounts (a contract that states what is owed serves as the
// invoice). TPS: Revenu Québec's notice of 21 October 2026 (registration in force since 1 October 2026), written the way
// the owner's Revenu Québec file shows it. TVQ: given by the owner on 26 October 2026 from the same file. A number set to
// null is left off the contract.
export const TAX_NUMBERS: { gst: string | null; qst: string | null } = { gst: "745767772 RT0001", qst: "1234246654 TQ0001" };

// Per-size facts of the handover sheet (annex A), from the rental contract template —
// legally significant, do not infer or alter these. The temperature range and the hitch ball
// come from the catalogue, the same figures the site shows.
type TrailerContractSpec = {
  axles: number;
  exterior: string;
  interior: string;
  // Step, stabilizer legs and generator spot: only the 6x12 has them.
  extras: boolean;
};

const TRAILER_SPECS: Record<TrailerSize, TrailerContractSpec> = {
  "5x10": { axles: 1, exterior: "5 pi × 10 pi", interior: "52 po × 110 po", extras: false },
  "6x12": { axles: 2, exterior: "6 pi 6 po × 12 pi", interior: "70 po × 120 po", extras: true },
};

// Text with bold passages: a plain string, or a bold one.
export type Run = string | { bold: string };

export type SignatureParty = {
  title: string;
  // "label : ____": the number is the length of the blank.
  fields: { label: string; blank: number }[];
  // The party who signs on the screen: the signature block takes its place here once signed.
  signer?: boolean;
};

// The contract, block after block. The PDF (contract-pdf.ts) and the page the client signs on (ContractView)
// both draw these, so the two always show the same wording.
export type ContractLine =
  // Opens a page: the small line above, then the big title.
  | { type: "page"; eyebrow: string; title: string }
  | { type: "heading"; text: string }
  // Lines left as they are written, each one wrapped if it is too long for the width.
  | { type: "paragraph"; lines: Run[][] }
  | { type: "note"; text: string }
  // Shaded rows of a label and a value; a value is a few lines.
  | { type: "table"; rows: { label: string; lines: Run[][] }[] }
  // Shaded rows of a label and an amount.
  | { type: "amounts"; rows: { label: string; amount: string; strong?: boolean }[] }
  | { type: "signatures"; heading: string; intro: Run[]; parties: SignatureParty[] }
  // The line at the foot of every page of the PDF.
  | { type: "footer"; text: string };

const NBSP = "\u00a0";

// 195000 -> "1 950,00 $", with spaces that never break between the thousands or before the sign.
function money(cents: number, whole = false): string {
  const abs = Math.max(0, Math.round(cents));
  const dollars = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const rest = abs % 100;
  return whole && rest === 0 ? `${dollars}${NBSP}$` : `${dollars},${String(rest).padStart(2, "0")}${NBSP}$`;
}

const COUNT_WORDS = ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];

const bold = (text: string): Run => ({ bold: text });
const para = (...runs: Run[]): ContractLine => ({ type: "paragraph", lines: [runs] });
const withPeriod = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

// "-18°C à +15°C" -> "−18 °C à +15 °C": a true minus sign and a space before the unit.
const temperatureRange = (label: string) => label.replace(/-/g, "−").replace(/°C/g, " °C");

// "11 novembre au 26 décembre 2026", or with both years when the rental spans two.
function periodLabel(start: string, end: string): string {
  const from = fmt(start);
  return start.slice(0, 4) === end.slice(0, 4) ? `${from.replace(/ \d{4}$/, "")} au ${fmt(end)}` : `${from} au ${fmt(end)}`;
}

// Wording written once for the contract, the same for every booking.
const PAYMENT_TERMS: ContractLine[] = [
  para(
    bold("Livraison par le Locateur :"),
    " le paiement intégral doit être reçu et confirmé avant le départ de la remorque des installations du Locateur pour sa livraison.",
  ),
  para(
    bold("Prise en charge aux bureaux du Locateur :"),
    " le paiement intégral est exigible lors de la remise de la remorque au Locataire, avant son départ avec celle-ci.",
  ),
  para(
    "Après en avoir informé le Locataire et sous réserve de la loi, le Locateur peut suspendre la livraison ou la remise jusqu’à confirmation du paiement exigible. Le dépôt de garantie est distinct du prix de location et ne remplace pas son paiement.",
  ),
  para(
    "Pour un contrat conclu à distance avec un consommateur, tout paiement perçu avant livraison est effectué par carte de crédit, sauf exception permise par la loi. Les droits de remboursement ou d’annulation prévus par la loi demeurent applicables.",
  ),
  para(
    "Toute prolongation exige une entente écrite précisant sa durée, son prix et son échéance de paiement. Les autres sommes légalement exigibles après la remise font l’objet d’une facture détaillée, payable dans les ",
    bold("quinze (15) jours suivant sa réception"),
    ".",
  ),
];

const LATE_PAYMENT: ContractLine[] = [
  para(
    "Toute somme due et impayée après l’échéance convenue porte intérêt au taux de ",
    bold("2 % par mois, capitalisé mensuellement"),
    ", soit un taux nominal annuel de ",
    bold("24 %"),
    " et un taux annuel effectif d’environ ",
    bold("26,82 %"),
    ", du lendemain de l’échéance jusqu’au paiement intégral.",
  ),
  para(
    "Les intérêts sont calculés sur le solde impayé selon la durée réelle du retard. À la fin de chaque période mensuelle suivant l’échéance, les intérêts échus et impayés sont ajoutés au solde et portent intérêt au même taux. Une période inférieure à un mois est calculée au prorata des jours de la période mensuelle concernée.",
  ),
  para(
    "Aucuns frais fixes ni pénalités forfaitaires ne sont exigés pour un retard de paiement ou un chèque sans provision. Le Locateur peut réclamer les frais de justice et autres sommes légalement recouvrables, dans les limites autorisées par la loi ou accordées par un tribunal. Cette clause ne limite aucun droit impératif du client, notamment en vertu de la Loi sur la protection du consommateur.",
  ),
];

function depositArticle(): ContractLine[] {
  const deposit = money(DEPOSIT_AMOUNT_CENTS, true);
  return [
    { type: "heading", text: `7. Dépôt de garantie de ${deposit} CAD` },
    para(
      "Le Locataire fournit une carte de crédit valide, enregistrée de façon sécurisée par le prestataire de paiement. Le Locateur ne conserve pas le numéro complet de la carte. Avant la remise, une ",
      bold(`préautorisation de ${deposit}`),
      " est effectuée : il s’agit d’une retenue sur le crédit disponible et non d’un prélèvement du dépôt.",
    ),
    para(
      "La durée de la préautorisation varie selon l’émetteur, le réseau et le prestataire. Le Locataire autorise, si nécessaire, de nouvelles préautorisations pendant la location, après information du Locataire et selon les règles du prestataire. Le Locateur demande la libération de toute retenue remplacée; un chevauchement temporaire peut toutefois résulter des délais bancaires. Si une nouvelle autorisation échoue, les parties conviennent d’une solution conforme à la loi, sans prélèvement automatique du dépôt pour la seule raison que la retenue expire.",
    ),
    para(
      "Le dépôt peut servir au paiement de sommes exigibles au titre du contrat, notamment de dommages imputables au Locataire ou d’un nettoyage supplémentaire nécessaire et justifié. ",
      bold("L’usure normale et les dommages préexistants sont exclus."),
      " Avant tout prélèvement, le Locateur communique au Locataire les photos, le décompte et les justificatifs disponibles, et lui donne une possibilité raisonnable de présenter ses observations. Le dépôt ne constitue pas une indemnité forfaitaire.",
    ),
    para(
      "Le Locateur effectue l’inspection et transmet son résultat dans les ",
      bold("deux (2) jours ouvrables"),
      " suivant la reprise effective de la remorque. Si aucune somme n’est due, il demande alors la libération de la retenue et en confirme la demande au Locataire. Tout montant non utilisé est libéré dès que son maintien n’est plus justifié. Le délai bancaire de disponibilité demeure indépendant du Locateur.",
    ),
    para(
      "Le dépôt ne remplace pas une assurance et ne limite pas la responsabilité légalement établie du Locataire. Toute réclamation excédentaire doit être détaillée et justifiée.",
    ),
  ];
}

const USE_AND_BREAKDOWN: ContractLine[] = [
  { type: "heading", text: "8. Utilisation et surveillance" },
  para(
    "Le Locateur remet une remorque propre, en bon état de fonctionnement et adaptée à l’usage convenu, avec les consignes applicables. Le Locataire respecte ces consignes : alimentation électrique, rallonges autorisées, ventilation, limites de charge, circulation de l’air, stabilisation et fermeture des portes.",
  ),
  para(
    "Avant le chargement, le Locataire vérifie que la température requise est atteinte. Il surveille régulièrement la température et prend les mesures appropriées pour conserver ses marchandises. Sauf confirmation écrite du Locateur, l’équipement est destiné au ",
    bold("maintien en température de produits déjà refroidis ou congelés"),
    ", et non à leur refroidissement ou congélation rapide.",
  ),
  para(
    "Le Locataire garde les accès et les équipements de sécurité dégagés. Il respecte les lois applicables et n’effectue aucune modification à la remorque ou à l’unité. Tout déplacement autorisé exige un véhicule, un attelage, des dispositifs de freinage et un conducteur adaptés, ainsi que le respect des limites de poids.",
  ),
  { type: "heading", text: "9. Panne ou incident" },
  para(
    "Le Locataire avise immédiatement le Locateur de toute panne, coupure de courant, température anormale, perte ou dommage et prend les mesures raisonnables pour limiter les pertes, dont le transfert des marchandises si nécessaire. Aucune réparation ne doit être entreprise sans autorisation, sauf mesure urgente permise par la loi. Le Locateur prend en charge le signalement et met en œuvre les mesures raisonnables de diagnostic et d’intervention. Les responsabilités et recours de chaque partie demeurent soumis aux lois applicables.",
  ),
];

const INSURANCE: ContractLine[] = [
  { type: "heading", text: "10. Assurances adaptées à la réservation" },
  para(
    "Avant la remise, le Locataire présente une preuve d’assurance en vigueur, dont le Locateur prend une photographie lisible pour le dossier de location. Le Locataire maintient les garanties convenues pendant toute la période où il a la garde de la remorque. Si les documents présentés ne permettent pas de confirmer les garanties requises, une attestation complémentaire de l’assureur ou du courtier est demandée. La photographie ne constitue pas, à elle seule, une confirmation de l’étendue de la couverture.",
  ),
  para(
    bold("Responsabilité civile :"),
    " une limite minimale de 2 000 000 $ est requise, au moyen d’une assurance adaptée au statut du Locataire et à l’usage réel. Pour une entreprise, il s’agit d’une couverture d’entreprise appropriée; pour un particulier, d’une couverture personnelle confirmée par l’assureur. L’assurance responsabilité civile automobile appropriée est également requise si le Locataire assure le remorquage.",
  ),
  para(
    bold("Dommages à la remorque :"),
    " la couverture doit viser expressément la remorque louée, y compris l’usage stationnaire et, s’il y a lieu, le transport. Le F.A.Q. nº 27 peut être utilisé si l’assureur confirme son applicabilité; sa seule présence ne garantit pas tous les dommages. Toute désignation du Locateur comme assuré additionnel ou bénéficiaire d’indemnité doit être confirmée par l’assureur selon la garantie concernée.",
  ),
  para(
    "Le Locataire vérifie la protection de ses marchandises, notamment contre les pertes liées à une panne ou à une variation de température. Le dépôt n’assure pas ces marchandises. Ces exigences d’assurance n’exonèrent pas le Locateur de sa propre responsabilité légale. Toute dérogation aux garanties convenues exige une acceptation écrite du Locateur avant la remise.",
  ),
];

const END_OF_RENTAL: ContractLine[] = [
  { type: "heading", text: "12. Prolongation, annulation et retour anticipé" },
  para(
    "Toute prolongation doit être acceptée par écrit avant la fin prévue. Si le Locataire conserve la remorque ou empêche sa récupération sans accord, le Locateur peut exercer les recours légaux et réclamer les sommes justifiées auxquelles il a droit, sans pénalité forfaitaire automatique.",
  ),
  para(
    "Une demande d’annulation, de report ou de retour anticipé est transmise par écrit dès que possible. Elle ne déclenche pas de pénalité automatique. Les parties confirment par écrit les effets sur le prix et tout remboursement; à défaut d’entente, leurs droits sont déterminés par la loi. Les droits impératifs du consommateur, y compris ceux liés aux contrats à distance, demeurent intégralement préservés.",
  ),
  { type: "heading", text: "13. Entente et acceptation" },
  para(
    "Le contrat et ses annexes constituent l’entente des parties. Toute modification exige leur consentement écrit. Le droit applicable et les règles impératives de compétence des tribunaux demeurent respectés. La nullité d’une disposition n’affecte pas les autres dispositions pouvant subsister. Une copie complète du contrat accepté est remise au Locataire.",
  ),
];

// Shared by the PDF generator (stub.ts) and the page the client signs on, so both always show the exact same
// wording. Mirrors the owner's revised contract of 27 October 2026; the sizes 5x10 and 6x12 differ in the
// handover sheet (annex A), and the transport in articles 2, 4 and 11.
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
  // How the trailer gets to the client and back. Absent or "pickup": the client comes to the depot both ways.
  // `deliveryFeeCents` is part of `totalCents`.
  deliveryOption?: DeliveryOption;
  deliveryFeeCents?: number;
  // Defaults to the Locateur's own numbers; a test can pass others.
  taxNumbers?: { gst: string | null; qst: string | null };
  // How many pages the PDF has, written out in the signature paragraph.
  pageCount?: number;
}): ContractLine[] {
  const n = nights(p.start, p.end);
  const days = `${n} jour${n > 1 ? "s" : ""}`;
  const periods = `${n} période${n > 1 ? "s" : ""}`;
  const catalogue = catalogueFor(p.trailerSize);
  const spec = TRAILER_SPECS[p.trailerSize];
  const model = p.trailerSize.replace("x", " × ");
  const clientName = `${p.firstName} ${p.lastName}`;
  const company = p.company?.trim() || null;
  const taxNumbers = p.taxNumbers ?? TAX_NUMBERS;
  const delivery = p.deliveryOption ?? "pickup";
  const weDeliver = delivery === "delivery" || delivery === "delivery_only";
  const weCollect = delivery === "delivery" || delivery === "return_only";
  const transportCents = delivery === "pickup" ? 0 : Math.min(Math.max(p.deliveryFeeCents ?? 0, 0), p.totalCents);
  const tax = computeTaxBreakdown(p.totalCents);
  const pageCount = p.pageCount ?? CONTRACT_PAGE_COUNT;

  const city = p.billingCity && p.billingProvince ? `${p.billingCity} (${p.billingProvince})` : p.billingCity || p.billingProvince || "";
  const address = [p.billingAddress, [city, p.billingPostalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const place = withPeriod(p.usageLocation?.trim() || "À préciser");

  const handover = weDeliver ? `Livraison par ICEBOX le ${fmt(p.start)}.` : `Prise en charge aux bureaux du Locateur le ${fmt(p.start)}.`;
  const giveBack = weCollect ? `Récupération par ICEBOX le ${fmt(p.end)}.` : `Retour aux bureaux du Locateur le ${fmt(p.end)}.`;

  const lines: ContractLine[] = [];
  const add = (...blocks: ContractLine[]) => lines.push(...blocks);

  // Page 1
  add({ type: "page", eyebrow: `CONTRAT DE LOCATION • VERSION RÉVISÉE DU ${CONTRACT_VERSION_DATE.toUpperCase()}`, title: "Remorque réfrigérée" });
  add(
    para(
      bold("Version à compléter avant signature."),
      " Les champs laissés en blanc doivent être remplis et les renseignements techniques et d’assurance confirmés avant l’acceptation du contrat.",
    ),
  );
  add({ type: "heading", text: "1. Parties au contrat" });
  add({
    type: "table",
    rows: [
      { label: "Locateur", lines: [[bold(LOCATEUR_NAME)], [LOCATEUR_ADDRESS_LINE1], [LOCATEUR_ADDRESS_LINE2]] },
      {
        label: "Locataire",
        lines: [[bold(company ? `${company} / ${clientName}` : clientName)], ...[address, p.phone, p.email].filter(Boolean).map((text) => [text])],
      },
    ],
  });
  add({
    type: "paragraph",
    lines: [
      ["Nom légal exact du locataire : __________________________________________"],
      ["Statut : ☐ Particulier ☐ Entreprise individuelle ☐ Société / personne morale"],
      ["NEQ, s’il y a lieu : ____________________ Représentant : ____________________"],
      ["Qualité du représentant : ______________________________________________"],
    ],
  });

  add({ type: "heading", text: "2. Réservation et lieu d’utilisation" });
  add({
    type: "table",
    rows: [
      { label: "Période prévue", lines: [["Du ", bold(fmt(p.start)), " au ", bold(fmt(p.end)), "."], ["Début : ______ h ______ • Fin : ______ h ______"]] },
      {
        label: "Durée facturée",
        lines: [[bold(`Forfait de ${days}`), `, correspondant à ${periods} de 24 heures si les heures de début et de fin sont identiques.`]],
      },
      { label: "Lieu d’utilisation", lines: [[place]] },
      { label: "Transport convenu", lines: [[handover], [giveBack]] },
    ],
  });
  add(
    para(
      weCollect
        ? "Les heures et la disponibilité du service de récupération à la date prévue sont confirmées par écrit avant la signature."
        : "Les heures de remise et de retour à la date prévue sont confirmées par écrit avant la signature.",
      " Tout changement de lieu, déplacement par le Locataire ou sous-location exige l’autorisation écrite préalable du Locateur.",
    ),
  );
  add({ type: "heading", text: "3. Équipement loué" });
  add(
    para(
      `Remorque réfrigérée ICEBOX ${model}, à ${spec.axles === 1 ? "un essieu" : "deux essieux"}. La fiche d’identification et les caractéristiques à confirmer figurent à l’annexe A. Cette annexe et le constat de remise font partie du contrat.`,
    ),
  );

  // Page 2
  add({ type: "page", eyebrow: "CONDITIONS FINANCIÈRES", title: "Prix et paiement" });
  add({ type: "heading", text: "4. Prix convenu pour cette réservation" });
  add({
    type: "amounts",
    rows: [
      { label: `Location • forfait de ${days}`, amount: money(p.totalCents - transportCents) },
      ...(delivery === "pickup" ? [] : [{ label: `Transport • ${DELIVERY_OPTION_LABEL_FR[delivery].toLowerCase()}`, amount: money(transportCents) }]),
      { label: "Sous-total", amount: money(tax.subtotalCents) },
      { label: "TPS • 5 %", amount: money(tax.gstCents) },
      { label: "TVQ • 9,975 %", amount: money(tax.qstCents) },
      { label: "Total à payer • CAD", amount: money(tax.totalWithTaxCents), strong: true },
    ],
  });
  add(
    para(
      "Le prix forfaitaire ci-dessus prévaut sur toute grille tarifaire générale pour la période et les services indiqués. Aucun service additionnel ni changement de prix n’est imposé sans entente préalable, sauf somme autrement exigible en vertu de la loi.",
    ),
  );
  const numbers = [taxNumbers.gst && `TPS : ${taxNumbers.gst}`, taxNumbers.qst && `TVQ : ${taxNumbers.qst}`].filter(Boolean);
  if (numbers.length) add({ type: "note", text: numbers.join(" • ") });
  add({ type: "heading", text: "5. Modalités et échéance de paiement" }, ...PAYMENT_TERMS);
  add({ type: "heading", text: "6. Retards de paiement" }, ...LATE_PAYMENT);

  // Page 3
  add({ type: "page", eyebrow: "GARANTIE ET UTILISATION", title: "Dépôt et responsabilités" });
  add(...depositArticle(), ...USE_AND_BREAKDOWN);

  // Page 4
  add({ type: "page", eyebrow: "PROTECTION ET FIN DE LOCATION", title: "Assurance et retour" });
  add(...INSURANCE);
  add({ type: "heading", text: "11. Restitution et inspection" });
  add(
    para(
      weCollect
        ? "Pour cette réservation, le Locateur récupère la remorque au lieu et à la date convenus à l’article 2. Le Locataire la rend accessible, vidée, propre et accompagnée de ses accessoires, dans l’état constaté au départ, sous réserve de l’usure normale. Il suit les consignes de dégivrage et laisse les accès dégagés et déneigés lorsque nécessaire."
        : "Pour cette réservation, le Locataire rapporte la remorque aux bureaux du Locateur à la date convenue à l’article 2. Il la rend vidée, propre et accompagnée de ses accessoires, dans l’état constaté au départ, sous réserve de l’usure normale. Il suit les consignes de dégivrage.",
    ),
    para(
      "Les parties documentent l’état au départ et au retour par des photos datées et un constat indiquant les accessoires, dommages existants et observations. Le Locataire peut faire inscrire ses réserves; sa signature ne vaut pas renonciation aux droits prévus par la loi.",
    ),
  );
  if (weCollect) {
    add(
      para(
        "Si la remorque est disponible conformément au contrat et que la récupération est retardée par le Locateur, aucune prolongation de loyer n’est facturée pour ce seul retard. Le Locataire conserve raisonnablement la remorque en sécurité jusqu’à la reprise et informe le Locateur de toute difficulté.",
      ),
    );
  }
  add(...END_OF_RENTAL);

  // Page 5: the handover sheet and the signatures
  add({ type: "page", eyebrow: "ANNEXE A • PARTIE INTÉGRANTE DU CONTRAT", title: "Fiche de remise et signatures" });
  add({ type: "heading", text: "Identification et caractéristiques à confirmer" });
  add({
    type: "table",
    rows: [
      { label: "Modèle annoncé", lines: [[`ICEBOX ${model} • ${spec.axles} essieu${spec.axles > 1 ? "x" : ""}`]] },
      { label: "Identification", lines: [["Unité : ____________ Immatriculation : ______________"], ["Numéro de série : __________________________________"]] },
      { label: "Dimensions annoncées", lines: [[`Extérieures : ${spec.exterior}`], [`Intérieures : ${spec.interior} • À vérifier sur l’unité remise.`]] },
      {
        label: "Attelage et charge",
        lines: [[`Boule : ${catalogue?.hitchLabel ?? "—"} • PNBV : __________ kg`], ["Charge utile : __________ kg • Charges des rails : ______ kg"]],
      },
      {
        label: "Réfrigération",
        lines: [
          [`Plage annoncée : ${catalogue ? temperatureRange(catalogue.tempRangeLabel) : "—"} • Isolation annoncée : R-32.`],
          ["Unité de réfrigération : ICEBOX • Consigne : ______ °C"],
        ],
      },
      {
        label: "Alimentation validée",
        lines: [[bold("120 V CA • Circuit minimal : 15 A")], ["Prise de type américain."], ["Rallonge autorisée : ", bold("50 pi (15,24 m) maximum"), "."]],
      },
      { label: "Usage convenu", lines: [["Produits : __________________ ☐ Réfrigérés ☐ Congelés"]] },
    ],
  });
  add(
    para(
      bold("Alimentation et rallonge :"),
      " le Locataire utilise une prise compatible avec mise à la terre et une rallonge en bon état, adaptée à la puissance de l’unité et aux conditions d’utilisation. La longueur totale de rallonge ne doit pas dépasser ",
      bold("50 pi (15,24 m)"),
      ". Au-delà de cette longueur, le bon fonctionnement de l’unité n’est pas garanti. Cette restriction vise les problèmes attribuables à une alimentation inadéquate et ne limite pas les droits impératifs du Locataire ni la responsabilité légale du Locateur.",
    ),
  );
  add({ type: "heading", text: "Équipements, état et documents remis" });
  add({
    type: "paragraph",
    lines: [
      ["☐ Rails de suspension ☐ Éclairage LED ☐ Drain ☐ Valve de décompression"],
      ...(spec.extras ? [["☐ Marche ☐ Pattes stabilisatrices ☐ Emplacement avant pour génératrice"]] : []),
      ["Une génératrice n’est pas incluse, sauf entente écrite distincte."],
      ["Photos / constat de départ : __________________ Consignes remises : ☐ Oui"],
      ["Dommages ou accessoires manquants au départ : __________________________"],
      ["________________________________________________________________"],
    ],
  });
  add({ type: "heading", text: "Preuve d’assurance et contact" });
  add({
    type: "paragraph",
    lines: [
      [
        "Une photographie lisible de la preuve d’assurance présentée par le Locataire est conservée au dossier de location pour la vérification des garanties et, au besoin, le traitement d’une réclamation. Seuls les renseignements nécessaires sont recueillis et leur accès est limité aux personnes autorisées. Les exigences de couverture figurent à l’article 10.",
      ],
      ["Contact ICEBOX pour panne : __________________ Téléphone : ______________"],
    ],
  });
  add({
    type: "signatures",
    heading: "Signatures",
    intro: [
      `Les parties confirment les renseignements complétés et acceptent les ${COUNT_WORDS[pageCount] ?? pageCount} pages du présent contrat et les annexes jointes. Le représentant d’une entreprise déclare être autorisé à la représenter.`,
    ],
    parties: [
      {
        title: "Pour ICEBOX Inc.",
        fields: [
          { label: "Nom", blank: 22 },
          { label: "Signature", blank: 18 },
          { label: "Date", blank: 22 },
        ],
      },
      {
        title: "Pour le Locataire",
        signer: true,
        fields: [
          { label: "Nom / qualité", blank: 20 },
          { label: "Signature", blank: 24 },
          { label: "Date", blank: 28 },
        ],
      },
    ],
  });
  add({ type: "footer", text: `${company ?? clientName} • ${periodLabel(p.start, p.end)}` });

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

const runsText = (runs: Run[], marks: boolean) => runs.map((run) => (typeof run === "string" ? run : marks ? `**${run.bold}**` : run.bold)).join("");

// The contract as plain lines, one per line of text, in reading order. `marks` wraps the bold passages in **.
export function contractPlainLines(lines: ContractLine[], marks = false): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (line.type === "page") out.push(`## ${line.eyebrow}`, `## ${line.title}`);
    else if (line.type === "heading") out.push(`# ${line.text}`);
    else if (line.type === "paragraph") out.push(...line.lines.map((runs) => runsText(runs, marks)));
    else if (line.type === "note") out.push(line.text);
    else if (line.type === "table") {
      for (const row of line.rows) row.lines.forEach((runs, i) => out.push(`${i === 0 ? row.label : ""} | ${runsText(runs, marks)}`));
    } else if (line.type === "amounts") {
      for (const row of line.rows) out.push(`${row.label} | ${row.amount}`);
    } else if (line.type === "signatures") {
      out.push(`# ${line.heading}`, runsText(line.intro, marks));
      for (const party of line.parties) out.push(party.title, ...party.fields.map((field) => `${field.label} : ${"_".repeat(field.blank)}`));
    } else out.push(`-- ${line.text}`);
  }
  return out;
}

// Flat fallback for contexts that just need the gist (not used by the PDF/page, which draw buildContractLines()
// directly).
export function buildContractText(p: Parameters<typeof buildContractLines>[0]): string {
  return contractPlainLines(buildContractLines(p)).join("\n");
}
