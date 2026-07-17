import { fmt } from "@/lib/dates";

export function confirmationEmail(p: {
  firstName: string;
  trailerSize: string;
  start: string;
  end: string;
  totalCents: number;
  contractPdfUrl: string;
}) {
  const total = (p.totalCents / 100).toFixed(2);
  const subject = "Confirmation de votre réservation — IceBox";
  const html = `
    <div style="font-family: sans-serif; color: #1B2733;">
      <h2>Réservation confirmée</h2>
      <p>Bonjour ${p.firstName},</p>
      <p>Votre réservation d'une remorque ${p.trailerSize}
      du ${fmt(p.start)} au ${fmt(p.end)} est confirmée. Montant total estimé : ${total} $ (avant taxes).</p>
      <p><a href="${p.contractPdfUrl}">Consulter votre contrat signé</a></p>
      <p>Merci de votre confiance.</p>
    </div>
  `;
  return { subject, html };
}
