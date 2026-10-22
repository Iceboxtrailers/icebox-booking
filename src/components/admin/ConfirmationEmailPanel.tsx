"use client";

import { useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const btn = "shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[12px] hover:bg-hover aria-busy:opacity-50";

// The e-mail a client gets when their booking is confirmed (the summary and the signed contract). Staff can
// send it again: after a mail outage, once a typo in the address is corrected, or when the client lost it.
// `problem` is why the last attempt failed, if it did.
export function ConfirmationEmailPanel({
  reservationId,
  clientEmail,
  problem,
}: {
  reservationId: string;
  clientEmail: string;
  problem: string | null;
}) {
  const { confirm, dialog } = useConfirm();
  const [failure, setFailure] = useState(problem);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function resend() {
    // Not `disabled` while sending: a disabled button loses the keyboard focus the question just gave back to it.
    if (sending) return;
    const sure = await confirm(`Renvoyer le courriel de confirmation à ${clientEmail} ?`, { confirmLabel: "Renvoyer" });
    if (!sure) return;
    setResult(null);
    setSending(true);
    try {
      const res = await fetch(`/api/admin/reservations/${reservationId}/confirmation-email`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Impossible d'envoyer le courriel." });
        return;
      }
      setFailure(null);
      setResult({
        ok: true,
        message: `Courriel envoyé à ${data.to}${data.attached ? ", contrat signé en pièce jointe." : " (aucun contrat signé à joindre)."}`,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-3 rounded-lg border border-border-light bg-subtle p-3 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-medium">Courriel de confirmation</div>
          <div className="text-muted">Envoyé à {clientEmail} : le récapitulatif et le contrat signé.</div>
        </div>
        <button type="button" onClick={resend} aria-busy={sending} className={btn}>
          {sending ? "Envoi..." : "Renvoyer"}
        </button>
      </div>

      {failure && !result?.ok && (
        <div role="alert" className="mt-2 rounded-md border border-warn-line bg-warn-soft p-2 text-warn-text">
          Le dernier envoi a échoué : {failure}
        </div>
      )}
      {result && (
        <div role={result.ok ? "status" : "alert"} className={`mt-2 ${result.ok ? "text-green-700" : "text-red-600"}`}>
          {result.message}
        </div>
      )}
      {dialog}
    </div>
  );
}
