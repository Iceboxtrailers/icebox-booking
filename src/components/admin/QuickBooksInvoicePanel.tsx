"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { QuickBooksInvoiceState } from "@/lib/accounting/status";

const btn = "shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[12px] hover:bg-hover aria-busy:opacity-50";
const day = new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeZone: "America/Toronto" });

async function fetchState(reservationId: string): Promise<QuickBooksInvoiceState | null> {
  const res = await fetch(`/api/admin/reservations/${reservationId}/quickbooks`);
  return res.ok ? ((await res.json()) as QuickBooksInvoiceState) : null;
}

// Owner only. Says whether this booking's invoice is in QuickBooks, and in which company: in the test mode the
// invoice is created in Intuit's test company, which is not the owner's real QuickBooks. Also sends it, for a
// booking that was entered before QuickBooks was connected or whose sending failed.
export function QuickBooksInvoicePanel({ reservationId, clientName }: { reservationId: string; clientName: string }) {
  const { confirm, dialog } = useConfirm();
  const [state, setState] = useState<QuickBooksInvoiceState | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchState(reservationId).then((fresh) => {
      if (fresh && !cancelled) setState(fresh);
    });
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  async function send() {
    // Not `disabled` while sending: a disabled button loses the keyboard focus the question just gave back to it.
    if (sending || !state) return;
    const where = state.environment === "sandbox" ? " dans l'entreprise d'essai de QuickBooks" : " dans QuickBooks";
    const sure = await confirm(`Créer la facture de ${clientName}${where} ? Vérifiez qu'elle n'y existe pas déjà.`, {
      confirmLabel: "Créer la facture",
    });
    if (!sure) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/admin/reservations/${reservationId}/quickbooks`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Impossible d'envoyer la facture.");
      const fresh = await fetchState(reservationId);
      if (fresh) setState(fresh);
    } finally {
      setSending(false);
    }
  }

  if (!state?.connected) return null;

  const reference = state.invoiceNumber ? ` (n° ${state.invoiceNumber})` : state.invoiceId ? ` (référence ${state.invoiceId})` : "";

  return (
    <div className="mb-3 rounded-lg border border-border-light bg-subtle p-3 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-medium">Facture QuickBooks</div>
          {state.status === "synced" && (
            <div className="text-muted">
              Créée{state.syncedAt ? ` le ${day.format(new Date(state.syncedAt))}` : ""}
              {reference}.
            </div>
          )}
          {state.status === "syncing" && <div className="text-muted">Envoi en cours...</div>}
          {state.status === "failed" && <div className="text-muted">La dernière tentative a échoué.</div>}
          {(state.status === "none" || state.status === "skipped") && <div className="text-muted">Pas encore envoyée à QuickBooks.</div>}
          {!state.ready && state.status !== "synced" && (
            <div className="text-muted">Terminez d&apos;abord la configuration (page Comptabilité).</div>
          )}
        </div>
        {state.ready && state.status !== "synced" && state.status !== "syncing" && (
          <button type="button" onClick={send} aria-busy={sending} className={btn}>
            {sending ? "Envoi..." : state.status === "failed" ? "Réessayer" : "Envoyer la facture"}
          </button>
        )}
      </div>

      {state.status === "synced" && state.environment === "sandbox" && (
        <div className="mt-2 rounded-md border border-warn-line bg-warn-soft p-2 text-warn-text">
          Mode essai : cette facture est dans l&apos;entreprise d&apos;essai d&apos;Intuit, pas dans votre vrai QuickBooks.
        </div>
      )}
      {state.status === "failed" && state.error && (
        <div role="alert" className="mt-2 rounded-md border border-warn-line bg-warn-soft p-2 text-warn-text">
          {state.error}
        </div>
      )}
      {error && (
        <div role="alert" className="mt-2 text-red-600">
          {error}
        </div>
      )}
      {dialog}
    </div>
  );
}
