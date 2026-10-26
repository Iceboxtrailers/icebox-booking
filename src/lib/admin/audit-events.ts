import { fmt, quebecDay } from "@/lib/dates";
import { DOCUMENT_TYPE_LABEL_FR } from "@/lib/constants";
import type { DocumentType, VerificationStatus } from "@/lib/constants";

// The audit log is written all over the app (deposits, contracts, documents, e-mails, accounting, staff).
// This turns an entry into a sentence the owner can read, and sorts the entries into the filters of the
// "Journal" page. Pure on purpose (no database), so it is tested on its own.

export const AUDIT_CATEGORIES = [
  { id: "problemes", label: "À vérifier" },
  { id: "depots", label: "Dépôts et paiements" },
  { id: "contrats", label: "Contrats" },
  { id: "documents", label: "Documents" },
  { id: "retours", label: "Retours" },
  { id: "courriels", label: "Courriels" },
  { id: "compta", label: "Comptabilité" },
  { id: "equipe", label: "Équipe et sécurité" },
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]["id"];

type Topic = Exclude<AuditCategory, "problemes">;

// Every action the app writes. `problem` marks what the owner should look at ("À vérifier"). A new action
// must be added here (a test fails otherwise), or it would only show under "Tout" with its raw name.
const KNOWN_ACTIONS: Record<string, { topic: Topic; problem?: true }> = {
  card_saved: { topic: "depots" },
  deposit_authorized: { topic: "depots" },
  deposit_captured: { topic: "depots" },
  deposit_released: { topic: "depots" },
  deposit_link_created: { topic: "depots" },
  deposit_expired: { topic: "depots" },
  deposit_released_externally: { topic: "depots" },
  deposit_captured_externally: { topic: "depots" },
  departure_deposit_waived: { topic: "depots" },
  deposit_payment_failed: { topic: "depots", problem: true },
  deposit_authorize_failed: { topic: "depots", problem: true },
  deposit_renew_old_hold_not_released: { topic: "depots", problem: true },
  deposit_link_emailed: { topic: "courriels" },
  email_resent: { topic: "courriels" },
  email_failed: { topic: "courriels", problem: true },
  contract_signed: { topic: "contrats" },
  document_viewed: { topic: "documents" },
  document_verification: { topic: "documents" },
  inspection_photo_added: { topic: "retours" },
  inspection_accepted: { topic: "retours" },
  inspection_issue: { topic: "retours" },
  quickbooks_connected: { topic: "compta" },
  quickbooks_configured: { topic: "compta" },
  quickbooks_disconnected: { topic: "compta" },
  quickbooks_company_changed: { topic: "compta" },
  quickbooks_invoice_created: { topic: "compta" },
  quickbooks_sync_failed: { topic: "compta", problem: true },
  employee_created: { topic: "equipe" },
  employee_deleted: { topic: "equipe" },
  employee_password_reset: { topic: "equipe" },
  employee_mfa_reset: { topic: "equipe" },
  mfa_enabled: { topic: "equipe" },
  mfa_disabled: { topic: "equipe" },
};

export const KNOWN_AUDIT_ACTIONS = Object.keys(KNOWN_ACTIONS);

export function isAuditCategory(value: unknown): value is AuditCategory {
  return AUDIT_CATEGORIES.some((category) => category.id === value);
}

// The actions a filter shows. `problemes` gathers the ones that went wrong, whatever their topic.
export function actionsInCategory(category: AuditCategory): string[] {
  return KNOWN_AUDIT_ACTIONS.filter((action) =>
    category === "problemes" ? KNOWN_ACTIONS[action].problem === true : KNOWN_ACTIONS[action].topic === category,
  );
}

export function isProblemAction(action: string): boolean {
  return KNOWN_ACTIONS[action]?.problem === true;
}

export type AuditDescription = { title: string; detail: string | null; problem: boolean };

// Names looked up by the page: the client a document belongs to.
export type AuditContext = { clientName?: string | null };

function record(details: unknown): Record<string, unknown> {
  return details && typeof details === "object" && !Array.isArray(details) ? (details as Record<string, unknown>) : {};
}

function text(value: unknown, max = 220): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function money(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? (value / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
    : null;
}

function quebecDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : fmt(quebecDay(date));
}

const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(" — ") || null;

// documents/<clientId>/<license|insurance>-<time>-<random>.<ext>
export function documentFromPath(path: unknown): { clientId: string; type: DocumentType } | null {
  const match = typeof path === "string" ? path.match(/^documents\/([^/]+)\/(license|insurance)-/) : null;
  return match ? { clientId: match[1], type: match[2] as DocumentType } : null;
}

// The client a document event is about, so the page can look the name up.
export function clientIdOfDocumentEvent(action: string, details: unknown): string | null {
  const d = record(details);
  if (action === "document_viewed") return documentFromPath(d.path)?.clientId ?? null;
  if (action === "document_verification") return typeof d.clientId === "string" ? d.clientId : null;
  return null;
}

const VERIFICATION_VERB: Record<VerificationStatus, string> = { pending: "remis à vérifier", verified: "vérifié", rejected: "refusé" };

export function describeAuditEvent(event: { action: string; details: unknown }, context: AuditContext = {}): AuditDescription {
  const d = record(event.details);
  const problem = isProblemAction(event.action);
  const make = (title: string, detail: string | null = null): AuditDescription => ({ title, detail, problem });

  switch (event.action) {
    case "card_saved":
      return make("Carte enregistrée par le client", "pour le dépôt de sécurité");
    case "contract_signed":
      return make(
        "Contrat signé par le client",
        d.method === "typed" ? "nom tapé comme signature" : d.method === "drawn" ? "signature dessinée" : null,
      );
    case "deposit_authorized":
      return make(
        "Retenue du dépôt placée",
        join(money(d.amountCents), d.via === "secure_link" ? "confirmée par le client avec son lien" : d.via === "off_session" ? "placée par le personnel" : null),
      );
    case "deposit_captured":
      return make("Dépôt prélevé", money(d.amountCents));
    case "deposit_released":
      return make(
        "Dépôt libéré",
        d.via === "inspection_accepted" ? "après l'acceptation du retour" : d.via === "owner_manual" ? "libéré à la main par le propriétaire" : null,
      );
    case "deposit_link_created":
      return make("Lien de confirmation du dépôt créé", quebecDate(d.expiresAt) ? `valide jusqu'au ${quebecDate(d.expiresAt)}` : null);
    case "deposit_link_emailed":
      return make(
        d.delivered === false ? "Lien du dépôt non envoyé (courriels pas encore configurés)" : "Lien du dépôt envoyé par courriel",
        text(d.to),
      );
    case "deposit_payment_failed":
      return make("Paiement du dépôt refusé", text(d.message));
    case "deposit_authorize_failed":
      return make("Retenue du dépôt impossible", text(d.message));
    case "deposit_renew_old_hold_not_released":
      return make("Ancienne retenue non libérée au renouvellement", "à libérer dans Stripe");
    case "deposit_expired":
      return make("Retenue du dépôt expirée");
    case "deposit_released_externally":
      return make("Retenue libérée depuis Stripe");
    case "deposit_captured_externally":
      return make("Dépôt prélevé depuis Stripe", money(d.amountCents));
    case "departure_deposit_waived":
      return make("Remise sans retenue de dépôt autorisée", "dépôt pris autrement");
    case "inspection_photo_added":
      return make("Photo d'inspection ajoutée");
    case "inspection_accepted":
      return make(
        "Retour accepté",
        join(
          typeof d.photoCount === "number" ? `${d.photoCount} photo${d.photoCount > 1 ? "s" : ""}` : null,
          d.depositReleased === true ? "dépôt libéré" : null,
        ),
      );
    case "inspection_issue":
      return make("Problème signalé au retour", text(d.notes));
    case "document_viewed": {
      const document = documentFromPath(d.path);
      return make(document ? `Document consulté : ${DOCUMENT_TYPE_LABEL_FR[document.type].toLowerCase()}` : "Document consulté", context.clientName ?? null);
    }
    case "document_verification": {
      const type = d.type === "license" || d.type === "insurance" ? DOCUMENT_TYPE_LABEL_FR[d.type].toLowerCase() : "document";
      const verb = typeof d.to === "string" && d.to in VERIFICATION_VERB ? VERIFICATION_VERB[d.to as VerificationStatus] : "mis à jour";
      return make(`Document « ${type} » ${verb}`, context.clientName ?? null);
    }
    case "quickbooks_connected":
      return make("QuickBooks connecté");
    case "quickbooks_configured":
      return make("Réglages QuickBooks enregistrés");
    case "quickbooks_disconnected":
      return make("QuickBooks déconnecté");
    case "quickbooks_company_changed": {
      const clients = typeof d.clients === "number" ? d.clients : 0;
      const reservations = typeof d.reservations === "number" ? d.reservations : 0;
      return make(
        "Autre entreprise QuickBooks connectée",
        reservations > 0
          ? `${reservations} réservation${reservations > 1 ? "s" : ""} et ${clients} client${clients > 1 ? "s" : ""} liés à l'ancienne entreprise remis à zéro : à renvoyer au besoin`
          : "aucune facture liée à l'ancienne entreprise",
      );
    }
    case "quickbooks_invoice_created":
      return make("Facture QuickBooks créée", text(d.invoiceNumber) ? `n° ${text(d.invoiceNumber)}` : null);
    case "quickbooks_sync_failed":
      return make("Facture QuickBooks non créée", text(d.message));
    case "employee_created":
      return make("Employé créé", text(d.username));
    case "employee_deleted":
      return make("Employé supprimé", text(d.username));
    case "employee_password_reset":
      return make("Mot de passe d'un employé réinitialisé", text(d.username));
    case "employee_mfa_reset":
      return make("Authentification à deux facteurs d'un employé réinitialisée", text(d.username));
    case "mfa_enabled":
      return make("Authentification à deux facteurs activée", text(d.username));
    case "mfa_disabled":
      return make("Authentification à deux facteurs désactivée", text(d.username));
    case "email_resent":
      return make(
        "Courriel de confirmation renvoyé au client",
        join(text(d.to), d.attached === false ? "sans contrat en pièce jointe" : null),
      );
    case "email_failed":
      return make(
        d.kind === "client_confirmation"
          ? d.resend === true
            ? "Renvoi du courriel de confirmation échoué"
            : "Courriel de confirmation non envoyé au client"
          : "Courriel non envoyé",
        text(d.message),
      );
    default:
      // An action this page does not know yet: shown as it is rather than hidden.
      return make(event.action);
  }
}

export function actorLabel(actorType: string, name: string | null): string {
  if (actorType === "admin") return name ?? "Employé supprimé";
  if (actorType === "client") return name ?? "Client";
  if (actorType === "system") return "Système";
  if (actorType === "stripe") return "Stripe";
  return actorType;
}
