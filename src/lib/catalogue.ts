import type { TrailerSize, TrailerType } from "@/lib/constants";

export type CatalogueModel = {
  model: string;
  type: TrailerType;
  size: TrailerSize;
  tempRange: string;
  dailyRateCents: number;
  description: string;
};

// Mirrors the CATALOGUE constant from the original prototype (prototype-site-location.jsx).
export const CATALOGUE: CatalogueModel[] = [
  {
    model: "R510",
    type: "refrigerated",
    size: "5x10",
    tempRange: "-2°C à +4°C",
    dailyRateCents: 9500,
    description: "Idéale pour événements, traiteurs, petits volumes.",
  },
  {
    model: "R612",
    type: "refrigerated",
    size: "6x12",
    tempRange: "-2°C à +4°C",
    dailyRateCents: 13000,
    description: "Grand volume réfrigéré, quais et commerces.",
  },
  {
    model: "C510",
    type: "frozen",
    size: "5x10",
    tempRange: "-18°C à -22°C",
    dailyRateCents: 11500,
    description: "Congélation profonde, format compact.",
  },
  {
    model: "C612",
    type: "frozen",
    size: "6x12",
    tempRange: "-18°C à -22°C",
    dailyRateCents: 15000,
    description: "Congélation profonde, grand volume.",
  },
];

export function findCatalogueModel(model: string) {
  return CATALOGUE.find((c) => c.model === model);
}

export function catalogueFor(type: TrailerType, size: TrailerSize) {
  return CATALOGUE.filter((c) => c.type === type && c.size === size);
}
