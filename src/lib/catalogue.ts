import type { TrailerSize } from "@/lib/constants";

export type CatalogueEntry = {
  size: TrailerSize;
  tempRangeLabel: string;
  interiorDimensions: string;
  approxWeightLb: number;
  // "Main de remorque", same value as in the rental contract (contract-text.ts).
  hitchLabel: string;
  description: string;
  // Short "ideal for" line for the home page cards.
  idealFor: string;
};

// From "Offre de service Icebox 2026.pdf". Only 2 physical sizes exist — each
// is a single adjustable-temperature trailer, not separate refrigerated/frozen
// SKUs (that was placeholder data from the original prototype).
export const CATALOGUE: CatalogueEntry[] = [
  {
    size: "5x10",
    tempRangeLabel: "2°C à +15°C",
    interiorDimensions: "52\" L x 116\" P x 74\" H",
    approxWeightLb: 1800,
    hitchLabel: "2 po",
    description: "Idéale pour petits volumes, événements, traiteurs, chasseurs, commerces.",
    idealFor: "Petits volumes, événements, traiteurs, chasseurs, commerces",
  },
  {
    size: "6x12",
    tempRangeLabel: "-18°C à +15°C",
    interiorDimensions: "64\" L x 136\" P x 78\" H",
    approxWeightLb: 2400,
    hitchLabel: "2 5/16 po",
    description: "Grands volumes, événements, industries, distribution.",
    idealFor: "Grands volumes, événements, industries, distribution",
  },
];

// Included with every rental (same offer sheet).
export const INCLUDED_WITH_RENTAL = [
  "Câble d'alimentation 12 AWG de 50 pi",
  "Marche-pieds",
  "Support pour génératrice",
  "Surveillance de température",
  "Support technique",
];

export function catalogueFor(size: TrailerSize) {
  return CATALOGUE.find((c) => c.size === size);
}
