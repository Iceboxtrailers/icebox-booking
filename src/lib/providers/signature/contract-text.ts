import { fmt, nights } from "@/lib/dates";
import { TRAILER_TYPE_LABEL_FR, type TrailerType } from "@/lib/constants";

// Shared by the PDF generator (stub.ts) and the on-screen contract preview,
// so both always show the exact same wording.
export function buildContractText(p: {
  firstName: string;
  lastName: string;
  trailerType: string;
  trailerSize: string;
  start: string;
  end: string;
  dailyRateCents: number;
  totalCents: number;
}): string {
  const n = nights(p.start, p.end);
  const typeLabel = (TRAILER_TYPE_LABEL_FR[p.trailerType as TrailerType] ?? p.trailerType).toLowerCase();
  const rate = (p.dailyRateCents / 100).toFixed(2);
  const total = (p.totalCents / 100).toFixed(2);

  return (
    `Entre ${p.firstName} ${p.lastName} (« le client ») et l'entreprise, ` +
    `pour la location d'une remorque ${typeLabel} ${p.trailerSize}, du ${fmt(p.start)} au ${fmt(p.end)} ` +
    `(${n} jour(s)), au tarif de ${rate} $/jour, soit un total estimé de ${total} $. ` +
    `Un dépôt de sécurité sera autorisé sur la carte de crédit fournie. Le client reconnaît avoir fourni un ` +
    `permis de conduire et une preuve d'assurance valides.`
  );
}
