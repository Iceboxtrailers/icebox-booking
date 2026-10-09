"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DEPOSIT_AMOUNT_CENTS,
  DEPOSIT_STATUS_LABEL_FR,
  MAX_INSPECTION_PHOTOS,
  MIN_INSPECTION_PHOTOS,
} from "@/lib/constants";
import type { AdminRole, DepositStatus } from "@/lib/constants";
import { resizeImageForUpload } from "@/lib/client/image";

export type PanelInspection = { status: string; photoPaths: string[]; notes: string | null } | null;

export type PanelChange = {
  reservationStatus?: string;
  depositStatus?: string;
  depositAmountCents?: number;
  depositExpiresAt?: string | null;
  inspection?: PanelInspection;
};

const btn =
  "rounded-md border border-border px-2.5 py-1.5 text-[12px] hover:bg-[#EDF2F4] disabled:opacity-50";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });
}

export function DepositInspectionPanel({
  reservationId,
  role,
  reservationStatus,
  returnDate,
  depositStatus,
  depositAmountCents,
  depositExpiresAt,
  inspection,
  onChange,
}: {
  reservationId: string;
  role: AdminRole;
  reservationStatus: string;
  returnDate: string;
  depositStatus: string;
  depositAmountCents: number;
  depositExpiresAt: string | null;
  inspection: PanelInspection;
  onChange: (patch: PanelChange) => void;
}) {
  const base = `/api/admin/reservations/${reservationId}`;
  const isOwner = role === "owner";
  const active = reservationStatus === "confirmed" || reservationStatus === "in_progress";

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canSendLink, setCanSendLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [needsWaiver, setNeedsWaiver] = useState(false);
  const [capturingFees, setCapturingFees] = useState(false);
  const [feeAmountDollars, setFeeAmountDollars] = useState("");
  const [notes, setNotes] = useState(inspection?.notes ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const photoPaths = inspection?.photoPaths ?? [];
  const inspectionStatus = inspection?.status ?? "pending";
  const expiresBeforeReturn =
    depositExpiresAt !== null && depositStatus === "authorized" && new Date(depositExpiresAt) < new Date(`${returnDate}T23:59:59`);

  async function call(url: string, init?: RequestInit) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      return { res, data };
    } finally {
      setPending(false);
    }
  }

  async function authorize(renew: boolean) {
    const { res, data } = await call(`${base}/deposit/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ renew }),
    });
    if (!res.ok) {
      setError(data.error ?? "Impossible de placer la retenue");
      setCanSendLink(Boolean(data.canSendLink));
      return;
    }
    setCanSendLink(false);
    onChange({
      depositStatus: data.depositStatus,
      depositAmountCents: data.depositAmount,
      depositExpiresAt: data.depositExpiresAt,
    });
  }

  async function createLink() {
    const { res, data } = await call(`${base}/deposit/link`, { method: "POST" });
    if (!res.ok) {
      setError(data.error ?? "Impossible de créer le lien");
      return;
    }
    setLinkUrl(data.url);
  }

  async function startRental(extra: { acknowledgeDepositExpiry?: boolean; waiveDeposit?: boolean } = {}) {
    const { res, data } = await call(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress", ...extra }),
    });
    if (res.ok) {
      setNeedsWaiver(false);
      onChange({ reservationStatus: "in_progress" });
      return;
    }
    if (data.code === "deposit_expires_before_return") {
      if (window.confirm(`${data.error}.\n\nConfirmer la remise malgré tout ?`)) {
        await startRental({ ...extra, acknowledgeDepositExpiry: true });
      }
      return;
    }
    if (data.code === "deposit_required") setNeedsWaiver(isOwner);
    setError(data.error ?? "Impossible de marquer la remise");
  }

  async function captureFees() {
    const amountCents = feeAmountDollars ? Math.round(parseFloat(feeAmountDollars) * 100) : undefined;
    if (amountCents !== undefined && (!Number.isFinite(amountCents) || amountCents <= 0)) {
      setError("Montant invalide");
      return;
    }
    const { res, data } = await call(`${base}/deposit/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents }),
    });
    if (!res.ok) {
      setError(data.error ?? "Impossible de prélever le dépôt");
      return;
    }
    setCapturingFees(false);
    onChange({ depositStatus: data.depositStatus, depositAmountCents: data.amountCents });
  }

  async function ownerRelease() {
    if (!window.confirm("Libérer le dépôt sans passer par l'inspection ?")) return;
    const { res, data } = await call(`${base}/deposit/release`, { method: "POST" });
    if (!res.ok) {
      setError(data.error ?? "Impossible de libérer le dépôt");
      return;
    }
    onChange({ depositStatus: data.depositStatus });
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      let latest = photoPaths;
      for (const file of Array.from(files)) {
        if (latest.length >= MAX_INSPECTION_PHOTOS) break;
        const resized = await resizeImageForUpload(file);
        const form = new FormData();
        form.append("file", resized);
        const res = await fetch(`${base}/inspection/photos`, { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Échec du téléversement");
          break;
        }
        latest = data.photoPaths;
        onChange({ inspection: { status: inspectionStatus, photoPaths: latest, notes: inspection?.notes ?? null } });
      }
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function acceptReturn() {
    const { res, data } = await call(`${base}/inspection/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) {
      setError(data.error ?? "Impossible d'accepter le retour");
      return;
    }
    onChange({
      reservationStatus: "completed",
      depositStatus: data.depositStatus,
      inspection: { status: "accepted", photoPaths, notes: notes || null },
    });
  }

  async function reportIssue() {
    const { res, data } = await call(`${base}/inspection/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) {
      setError(data.error ?? "Impossible de signaler le problème");
      return;
    }
    onChange({ inspection: { status: "issue", photoPaths, notes } });
  }

  return (
    <div className="mb-3 space-y-3">
      <div className="rounded-lg border border-border-light bg-[#FAFBFB] p-3 text-[13px]">
        <div className="font-medium">Dépôt de sécurité</div>
        <div className="text-muted">
          {DEPOSIT_STATUS_LABEL_FR[depositStatus as DepositStatus] ?? depositStatus}
          {(depositStatus === "authorized" || depositStatus === "captured") &&
            ` — ${(depositAmountCents / 100).toFixed(2)} $`}
        </div>
        {depositStatus === "authorized" && depositExpiresAt && (
          <div className={expiresBeforeReturn ? "text-[#8a5a1c]" : "text-muted"}>
            Expire le {fmtDate(depositExpiresAt)}
            {expiresBeforeReturn && " — avant le retour : renouvellement requis pendant la location"}
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          {active && (depositStatus === "card_on_file" || depositStatus === "expired") && (
            <button type="button" className={btn} disabled={pending} onClick={() => authorize(false)}>
              {pending ? "..." : `Placer la retenue (${(DEPOSIT_AMOUNT_CENTS / 100).toLocaleString("fr-CA")} $)`}
            </button>
          )}
          {active && depositStatus === "authorized" && (
            <button type="button" className={btn} disabled={pending} onClick={() => authorize(true)}>
              Renouveler la retenue
            </button>
          )}
          {active && (depositStatus === "none" || canSendLink || depositStatus === "expired" || depositStatus === "authorized") && (
            <button type="button" className={btn} disabled={pending} onClick={createLink}>
              Lien de paiement client
            </button>
          )}
          {isOwner && depositStatus === "authorized" && (
            <>
              <button type="button" className={btn} disabled={pending} onClick={() => setCapturingFees((v) => !v)}>
                Ajouter des frais
              </button>
              <button type="button" className={btn} disabled={pending} onClick={ownerRelease}>
                Libérer (sans inspection)
              </button>
            </>
          )}
        </div>

        {linkUrl && (
          <div className="mt-2 rounded-md border border-border-light bg-white p-2 text-[12px]">
            <div className="mb-1 text-muted">Envoyez ce lien au client (valide 7 jours) :</div>
            <div className="flex items-center gap-2">
              <input readOnly value={linkUrl} className="min-w-0 flex-1 rounded border border-border px-2 py-1" />
              <button
                type="button"
                className={btn}
                onClick={() => navigator.clipboard?.writeText(linkUrl).catch(() => undefined)}
              >
                Copier
              </button>
            </div>
          </div>
        )}

        {capturingFees && (
          <div className="mt-2.5 flex items-center gap-2 border-t border-border-light pt-2.5">
            <Input
              type="number"
              step="0.01"
              min="0"
              max={depositAmountCents / 100}
              placeholder={`Max ${(depositAmountCents / 100).toFixed(2)} $`}
              value={feeAmountDollars}
              onChange={(e) => setFeeAmountDollars(e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="cta" onClick={captureFees} disabled={pending}>
              {pending ? "..." : "Prélever"}
            </Button>
          </div>
        )}
      </div>

      {reservationStatus === "confirmed" && (
        <div className="rounded-lg border border-border-light bg-[#FAFBFB] p-3 text-[13px]">
          <div className="font-medium">Remise de la remorque</div>
          <div className="mb-2 text-muted">
            La retenue du dépôt doit être active avant que la remorque ne parte.
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={pending} onClick={() => startRental()}>
              {pending ? "..." : "Marquer comme remise (en cours)"}
            </button>
            {needsWaiver && (
              <button
                type="button"
                className={btn}
                disabled={pending}
                onClick={() => {
                  if (window.confirm("Confirmer que le dépôt a été pris autrement (virement, comptant) ?")) {
                    void startRental({ waiveDeposit: true });
                  }
                }}
              >
                Dépôt pris autrement (propriétaire)
              </button>
            )}
          </div>
        </div>
      )}

      {(active || inspectionStatus !== "pending" || reservationStatus === "completed") && (
        <div className="rounded-lg border border-border-light bg-[#FAFBFB] p-3 text-[13px]">
          <div className="font-medium">Inspection au retour</div>

          {inspectionStatus === "accepted" || reservationStatus === "completed" ? (
            <div className="text-muted">Retour accepté.</div>
          ) : (
            <div className="mb-2 text-muted">
              {photoPaths.length} / {MIN_INSPECTION_PHOTOS} photos minimum
              {inspectionStatus === "issue" && " — problème signalé"}
            </div>
          )}

          {photoPaths.length > 0 && (
            <div className="mb-2 grid grid-cols-4 gap-1.5">
              {photoPaths.map((path) => (
                <a key={path} href={`/api/files/${path}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/files/${path}`} alt="Photo d'inspection" className="aspect-square w-full rounded object-cover" />
                </a>
              ))}
            </div>
          )}

          {inspectionStatus !== "accepted" && reservationStatus !== "completed" && active && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => uploadPhotos(e.target.files)}
              />
              <button
                type="button"
                className={`${btn} mb-2 inline-flex items-center gap-1.5`}
                disabled={uploading || photoPaths.length >= MAX_INSPECTION_PHOTOS}
                onClick={() => fileInput.current?.click()}
              >
                <Camera size={14} /> {uploading ? "Téléversement..." : "Ajouter des photos"}
              </button>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notes d'inspection (obligatoires pour signaler un problème)"
                className="mb-2 w-full rounded-md border border-border px-3 py-2 text-[13px] outline-none focus:border-navy"
              />

              {inspectionStatus === "issue" && !isOwner && (
                <div className="mb-2 text-[12px] text-[#8a5a1c]">
                  Un problème a été signalé : le propriétaire doit décider (frais ou acceptation du retour).
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="cta"
                  disabled={
                    pending ||
                    uploading ||
                    photoPaths.length < MIN_INSPECTION_PHOTOS ||
                    (inspectionStatus === "issue" && !isOwner)
                  }
                  onClick={acceptReturn}
                >
                  {pending ? "..." : "Retour accepté"}
                </Button>
                <button
                  type="button"
                  className={btn}
                  disabled={pending || uploading || photoPaths.length < 1}
                  onClick={reportIssue}
                >
                  Signaler un problème
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {error && <div className="text-[13px] text-red-600">{error}</div>}
    </div>
  );
}
