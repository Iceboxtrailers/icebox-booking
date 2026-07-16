// Mirrors the STEPS array from the original prototype (prototype-site-location.jsx).
export const WIZARD_STEPS = [
  "Compte",
  "Remorque et dates",
  "Disponibilités",
  "Documents",
  "Contrat",
  "Dépôt",
  "Confirmation",
] as const;

export const WIZARD_SEGMENTS = [
  "remorque-dates",
  "disponibilites",
  "documents",
  "contrat",
  "depot",
  "confirmation",
] as const;

export type WizardSegment = (typeof WIZARD_SEGMENTS)[number];

// "Compte" (step 0) happens on /signup + /login, before a reservation exists,
// so pages under /reservation/[id]/<segment> map to step index 1..6.
export function stepIndexForSegment(segment: string): number {
  const i = WIZARD_SEGMENTS.indexOf(segment as WizardSegment);
  return i === -1 ? 0 : i + 1;
}
