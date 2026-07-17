import { fmt, nights } from "@/lib/dates";

// Shared by the PDF generator (stub.ts) and the on-screen contract preview,
// so both always show the exact same wording.
export function buildContractText(p: {
  firstName: string;
  lastName: string;
  trailerSize: string;
  start: string;
  end: string;
  totalCents: number;
}): string {
  const n = nights(p.start, p.end);
  const total = (p.totalCents / 100).toFixed(2);

  return (
    `Entre ${p.firstName} ${p.lastName} (« le client ») et l'entreprise, ` +
    `pour la location d'une remorque ${p.trailerSize}, du ${fmt(p.start)} au ${fmt(p.end)} ` +
    `(${n} jour(s)), pour un total estimé de ${total} $ (avant taxes). ` +
    `Un dépôt de sécurité sera autorisé sur la carte de crédit fournie. Le client reconnaît avoir fourni un ` +
    `permis de conduire et une preuve d'assurance valides.`
  );
}
