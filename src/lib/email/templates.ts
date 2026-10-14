import { fmt } from "@/lib/dates";
import { DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";

// Everything a visitor types (names, messages) goes through this before it is put
// into an email, so nobody can inject markup or links into a message we send.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const money = (cents: number) => (cents / 100).toFixed(2);
const wrap = (inner: string) => `
  <div style="font-family: Arial, Helvetica, sans-serif; color: #1B2733; max-width: 560px; line-height: 1.5;">
    ${inner}
    <p style="margin-top: 24px; font-size: 12px; color: #6B7A86;">
      Remorques Réfrigérées ICEBOX Inc. — 1005 rue du Parc-Industriel, Lévis (Québec) G6Z 1C5<br>
      581 889-2093 — info@iceboxtrailers.ca
    </p>
  </div>`;

export function confirmationEmail(p: {
  firstName: string;
  trailerSize: string;
  start: string;
  end: string;
  totalCents: number;
  deliveryLabel: string | null; // e.g. "Livraison et récupération — 1 rue Test, Lévis"
}) {
  const subject = "Confirmation de votre réservation — IceBox";
  const html = wrap(`
    <h2>Réservation confirmée</h2>
    <p>Bonjour ${escapeHtml(p.firstName)},</p>
    <p>Votre réservation est confirmée :</p>
    <ul>
      <li>Remorque réfrigérée ${escapeHtml(p.trailerSize)}</li>
      <li>Du ${fmt(p.start)} au ${fmt(p.end)}</li>
      ${p.deliveryLabel ? `<li>${escapeHtml(p.deliveryLabel)}</li>` : "<li>Ramassage au dépôt de Lévis</li>"}
      <li>Montant : ${money(p.totalCents)} $ (avant taxes)</li>
    </ul>
    <p>Votre contrat signé est joint à ce courriel (PDF).</p>
    <p>Un dépôt de sécurité de ${money(DEPOSIT_AMOUNT_CENTS)} $ sera retenu sur la carte que vous avez enregistrée juste avant la remise de la remorque. Il n'est pas débité et il est libéré après l'inspection du retour.</p>
    <p>Pour toute question, répondez simplement à ce courriel.</p>
    <p>Merci de votre confiance.</p>`);
  return { subject, html };
}

export function passwordResetEmail(p: { firstName: string; resetUrl: string }) {
  const subject = "Réinitialisation de votre mot de passe — IceBox";
  const html = wrap(`
    <h2>Réinitialisation de mot de passe</h2>
    <p>Bonjour ${escapeHtml(p.firstName)},</p>
    <p>Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans 1 heure.</p>
    <p><a href="${p.resetUrl}">Réinitialiser mon mot de passe</a></p>
    <p>Si vous n'avez pas demandé cette réinitialisation, ignorez ce courriel.</p>`);
  return { subject, html };
}

export function depositLinkEmail(p: { firstName: string; link: string; expiresOn: string }) {
  const subject = "Dépôt de sécurité à confirmer avant la remise — IceBox";
  const html = wrap(`
    <h2>Dépôt de sécurité</h2>
    <p>Bonjour ${escapeHtml(p.firstName)},</p>
    <p>Pour préparer la remise de votre remorque, un dépôt de sécurité de ${money(DEPOSIT_AMOUNT_CENTS)} $ doit être retenu sur votre carte. Rien n'est débité : la retenue est libérée après le retour conforme de la remorque.</p>
    <p><a href="${p.link}" style="display:inline-block;padding:10px 16px;background:#1E78B4;color:#fff;text-decoration:none;border-radius:6px;">Confirmer le dépôt</a></p>
    <p style="font-size: 13px;">Ce lien est personnel et valide jusqu'au ${fmt(p.expiresOn)}.</p>`);
  return { subject, html };
}

export function internalNewReservationEmail(p: {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  trailerSize: string;
  start: string;
  end: string;
  totalCents: number;
  deliveryLabel: string | null;
  adminUrl: string;
}) {
  const subject = `Nouvelle réservation — ${p.clientName} (${fmt(p.start)} → ${fmt(p.end)})`;
  const html = wrap(`
    <h2>Nouvelle réservation confirmée</h2>
    <ul>
      <li><strong>Client :</strong> ${escapeHtml(p.clientName)} — ${escapeHtml(p.clientEmail)} — ${escapeHtml(p.clientPhone)}</li>
      <li><strong>Remorque :</strong> ${escapeHtml(p.trailerSize)}</li>
      <li><strong>Dates :</strong> ${fmt(p.start)} → ${fmt(p.end)}</li>
      <li><strong>Livraison :</strong> ${p.deliveryLabel ? escapeHtml(p.deliveryLabel) : "Ramassage au dépôt"}</li>
      <li><strong>Montant :</strong> ${money(p.totalCents)} $ (avant taxes)</li>
    </ul>
    <p><a href="${p.adminUrl}">Ouvrir la console</a></p>`);
  return { subject, html };
}

export function contactRequestEmail(p: { topic: string; name: string; email: string; phone?: string; message: string }) {
  const subject = `IceBox — Nouvelle demande (${p.topic.replace(/[\r\n]+/g, " ")})`;
  const html = wrap(`
    <h2>Nouvelle demande — ${escapeHtml(p.topic)}</h2>
    <p><strong>Nom :</strong> ${escapeHtml(p.name)}</p>
    <p><strong>Courriel :</strong> ${escapeHtml(p.email)}</p>
    ${p.phone ? `<p><strong>Téléphone :</strong> ${escapeHtml(p.phone)}</p>` : ""}
    <p><strong>Message :</strong></p>
    <p>${escapeHtml(p.message).replace(/\n/g, "<br>")}</p>`);
  return { subject, html };
}
