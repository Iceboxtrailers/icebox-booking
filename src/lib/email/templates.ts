import { fmt } from "@/lib/dates";
import { BRAND } from "@/lib/brand";
import { DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";
import { siteUrl } from "@/lib/site";

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

// Email clients ignore web fonts and stylesheets, so styles are inline and the font is a
// plain reading font; the brand shows through the real logo, the blue and the button.
// public/brand/logo-lockup.png is 744 x 753 px; shown at 120 px wide it stays sharp on high-density screens.
const LOGO_WIDTH = 120;
const LOGO_HEIGHT = 121;
const heading = (text: string) => `<h2 style="color: ${BRAND.navy}; margin: 20px 0 8px;">${text}</h2>`;
const buttonLink = (url: string, label: string) =>
  `<p><a href="${url}" style="display: inline-block; padding: 10px 18px; background: ${BRAND.navy}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">${label}</a></p>`;

const wrap = (inner: string) => `
  <div style="font-family: Arial, Helvetica, sans-serif; color: ${BRAND.text}; max-width: 560px; line-height: 1.5;">
    <div style="padding-bottom: 12px; border-bottom: 3px solid ${BRAND.navy};">
      <img src="${siteUrl()}/brand/logo-lockup.png" alt="IceBox — Remorque réfrigérée" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" style="display: block; border: 0;">
    </div>
    ${inner}
    <p style="margin-top: 24px; font-size: 12px; color: ${BRAND.muted};">
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
    ${heading("Réservation confirmée")}
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
    ${heading("Réinitialisation de mot de passe")}
    <p>Bonjour ${escapeHtml(p.firstName)},</p>
    <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans 1 heure.</p>
    ${buttonLink(p.resetUrl, "Réinitialiser mon mot de passe")}
    <p>Si vous n'avez pas demandé cette réinitialisation, ignorez ce courriel.</p>`);
  return { subject, html };
}

export function depositLinkEmail(p: { firstName: string; link: string; expiresOn: string }) {
  const subject = "Dépôt de sécurité à confirmer avant la remise — IceBox";
  const html = wrap(`
    ${heading("Dépôt de sécurité")}
    <p>Bonjour ${escapeHtml(p.firstName)},</p>
    <p>Pour préparer la remise de votre remorque, un dépôt de sécurité de ${money(DEPOSIT_AMOUNT_CENTS)} $ doit être retenu sur votre carte. Rien n'est débité : la retenue est libérée après le retour conforme de la remorque.</p>
    ${buttonLink(p.link, "Confirmer le dépôt")}
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
    ${heading("Nouvelle réservation confirmée")}
    <ul>
      <li><strong>Client :</strong> ${escapeHtml(p.clientName)} — ${escapeHtml(p.clientEmail)} — ${escapeHtml(p.clientPhone)}</li>
      <li><strong>Remorque :</strong> ${escapeHtml(p.trailerSize)}</li>
      <li><strong>Dates :</strong> ${fmt(p.start)} → ${fmt(p.end)}</li>
      <li><strong>Livraison :</strong> ${p.deliveryLabel ? escapeHtml(p.deliveryLabel) : "Ramassage au dépôt"}</li>
      <li><strong>Montant :</strong> ${money(p.totalCents)} $ (avant taxes)</li>
    </ul>
    ${buttonLink(p.adminUrl, "Ouvrir la console")}`);
  return { subject, html };
}

export function contactRequestEmail(p: { topic: string; name: string; email: string; phone?: string; message: string }) {
  const subject = `IceBox — Nouvelle demande (${p.topic.replace(/[\r\n]+/g, " ")})`;
  const html = wrap(`
    ${heading(`Nouvelle demande — ${escapeHtml(p.topic)}`)}
    <p><strong>Nom :</strong> ${escapeHtml(p.name)}</p>
    <p><strong>Courriel :</strong> ${escapeHtml(p.email)}</p>
    ${p.phone ? `<p><strong>Téléphone :</strong> ${escapeHtml(p.phone)}</p>` : ""}
    <p><strong>Message :</strong></p>
    <p>${escapeHtml(p.message).replace(/\n/g, "<br>")}</p>`);
  return { subject, html };
}
