"use client";

import { useState } from "react";
import { DOCUMENT_TYPE, DOCUMENT_TYPE_LABEL_FR, VERIFICATION_STATUS_LABEL_FR } from "@/lib/constants";
import type { DocumentType, VerificationStatus } from "@/lib/constants";
import type { ClientDocument } from "@/lib/admin/documents";

const btn = "rounded-md border border-border px-2.5 py-1.5 text-[12px] hover:bg-hover disabled:opacity-50";

const BADGE: Record<string, string> = {
  pending: "bg-warn-bg text-warn-text",
  verified: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const date = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { dateStyle: "medium" });
const statusLabel = (status: string) => VERIFICATION_STATUS_LABEL_FR[status as VerificationStatus] ?? status;

// The licence and insurance proof the client uploaded while booking. Staff open each file (every opening
// is logged) and mark it checked or refused; the newest document of each kind is the one that counts.
export function ClientDocumentsPanel({
  documents,
  reservationId,
}: {
  documents: ClientDocument[];
  // The booking being looked at, only to attribute the audit entry.
  reservationId?: string;
}) {
  const [docs, setDocs] = useState(documents);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mark(doc: ClientDocument, verificationStatus: VerificationStatus) {
    setError(null);
    setPendingId(doc.id);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus, reservationId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Impossible de mettre à jour le document");
        return;
      }
      setDocs((list) => list.map((d) => (d.id === doc.id ? { ...d, verificationStatus } : d)));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mb-3 rounded-lg border border-border-light bg-subtle p-3 text-[13px]">
      <div className="mb-1 font-medium">Documents du client</div>
      {docs.length === 0 && <div className="text-muted">Aucun document reçu pour ce client.</div>}

      {docs.length > 0 &&
        DOCUMENT_TYPE.map((type: DocumentType) => {
          const [latest, ...older] = docs.filter((d) => d.type === type);
          return (
            <div key={type} className="border-t border-border-light py-2 first:border-t-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div>{DOCUMENT_TYPE_LABEL_FR[type]}</div>
                  <div className="text-[12px] text-muted">{latest ? `Reçu le ${date(latest.uploadedAt)}` : "Non reçu"}</div>
                </div>
                {latest && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${BADGE[latest.verificationStatus] ?? BADGE.pending}`}>
                    {statusLabel(latest.verificationStatus)}
                  </span>
                )}
              </div>

              {latest && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <a href={latest.url} target="_blank" rel="noreferrer" className={btn}>
                    Ouvrir
                  </a>
                  {latest.verificationStatus !== "verified" && (
                    <button type="button" disabled={pendingId === latest.id} onClick={() => mark(latest, "verified")} className={btn}>
                      Marquer vérifié
                    </button>
                  )}
                  {latest.verificationStatus !== "rejected" && (
                    <button type="button" disabled={pendingId === latest.id} onClick={() => mark(latest, "rejected")} className={btn}>
                      Refuser
                    </button>
                  )}
                  {latest.verificationStatus !== "pending" && (
                    <button type="button" disabled={pendingId === latest.id} onClick={() => mark(latest, "pending")} className={btn}>
                      Remettre à vérifier
                    </button>
                  )}
                </div>
              )}

              {older.length > 0 && (
                <details className="mt-1.5 text-[12px] text-muted">
                  <summary className="cursor-pointer">
                    {older.length} ancien{older.length > 1 ? "s" : ""} document{older.length > 1 ? "s" : ""}
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {older.map((d) => (
                      <li key={d.id}>
                        {date(d.uploadedAt)} · {statusLabel(d.verificationStatus)} ·{" "}
                        <a href={d.url} target="_blank" rel="noreferrer" className="text-navy hover:underline">
                          Ouvrir
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}

      {error && <div role="alert" className="mt-2 text-[12px] text-red-600">{error}</div>}
    </div>
  );
}
