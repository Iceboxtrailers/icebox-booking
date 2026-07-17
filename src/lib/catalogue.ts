import type { TrailerSize } from "@/lib/constants";

export type CatalogueEntry = {
  size: TrailerSize;
  tempRangeLabel: string;
  interiorDimensions: string;
  approxWeightLb: number;
  description: string;
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
    description: "Idéale pour petits volumes, événements, traiteurs, chasseurs, commerces.",
  },
  {
    size: "6x12",
    tempRangeLabel: "-18°C à +15°C",
    interiorDimensions: "64\" L x 136\" P x 78\" H",
    approxWeightLb: 2400,
    description: "Grands volumes, événements, industries, distribution.",
  },
];

export function catalogueFor(size: TrailerSize) {
  return CATALOGUE.find((c) => c.size === size);
}
