import { fmt } from "@/lib/dates";
import { TRAILER_TYPE_LABEL_FR, type TrailerType } from "@/lib/constants";

export function confirmationEmail(p: {
  firstName: string;
  trailerModel: string;
  trailerType: string;
  trailerSize: string;
  start: string;
  end: string;
  totalCents: number;
  contractPdfUrl: string;
}) {
  const total = (p.totalCents / 100).toFixed(2);
  const typeLabel = TRAILER_TYPE_LABEL_FR[p.trailerType as TrailerType] ?? p.trailerType;
  const subject = "Confirmation de votre réservation — IceBox";
  const html = `
    <div style="font-family: sans-serif; color: #1B2733;">
      <h2>Réservation confirmée</h2>
      <p>Bonjour ${p.firstName},</p>
      <p>Votre réservation d'une remorque ${typeLabel} ${p.trailerSize} (${p.trailerModel})
      du ${fmt(p.start)} au ${fmt(p.end)} est confirmée. Montant total estimé : ${total} $.</p>
      <p><a href="${p.contractPdfUrl}">Consulter votre contrat signé</a></p>
      <p>Merci de votre confiance.</p>
    </div>
  `;
  return { subject, html };
}
