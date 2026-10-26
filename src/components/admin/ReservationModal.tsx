"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useModal } from "@/components/ui/useModal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ClientDocumentsPanel } from "@/components/admin/ClientDocumentsPanel";
import { ConfirmationEmailPanel } from "@/components/admin/ConfirmationEmailPanel";
import { QuickBooksInvoicePanel } from "@/components/admin/QuickBooksInvoicePanel";
import { ClientModal } from "@/components/admin/ClientModal";
import { DepositInspectionPanel, type PanelChange, type PanelInspection } from "@/components/admin/DepositInspectionPanel";
import type { ClientDocument } from "@/lib/admin/documents";
import { computeTotalCents } from "@/lib/pricing";
import { DELIVERY_OPTION, DELIVERY_OPTION_LABEL_FR, RESERVATION_STATUS, holdsSlot } from "@/lib/constants";
import type { AdminRole, DeliveryOption, TrailerSize } from "@/lib/constants";

type ModalState =
  | { mode: "edit"; reservationId: string }
  | { mode: "create"; trailerId: string; pickupDate: string };

type TrailerOption = { id: string; number: number; name: string; size: string };
type ClientOption = { id: string; firstName: string; lastName: string; email: string; phone: string };

const STATUS_LABEL_FR: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

function addOneDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Dollars typed in a field -> cents; anything unreadable counts as nothing.
const toCents = (dollars: string) => Math.round(parseFloat(dollars || "0") * 100) || 0;
const money = (cents: number) => `${(cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

export function ReservationModal({
  state,
  trailers,
  role,
  onClose,
}: {
  state: ModalState;
  trailers: TrailerOption[];
  role: AdminRole;
  onClose: () => void;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { titleId, dialogProps } = useModal(onClose);
  const [loading, setLoading] = useState(state.mode === "edit");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [trailerId, setTrailerId] = useState(state.mode === "create" ? state.trailerId : "");
  const [pickupDate, setPickupDate] = useState(state.mode === "create" ? state.pickupDate : "");
  const [returnDate, setReturnDate] = useState(
    state.mode === "create" ? addOneDay(state.pickupDate) : ""
  );
  const [totalAmountDollars, setTotalAmountDollars] = useState("");
  const [status, setStatus] = useState<string>("confirmed");
  const [note, setNote] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [isTest, setIsTest] = useState(false);
  // Transport: how the trailer travels, where it will be used, and what the transport costs (it is part of the total).
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>("pickup");
  const [usageLocation, setUsageLocation] = useState("");
  const [deliveryFeeDollars, setDeliveryFeeDollars] = useState("");
  const [deliveryKm, setDeliveryKm] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit mode: client display, fetched with the reservation; editable via ClientModal.
  const [clientDisplay, setClientDisplay] = useState<ClientOption | null>(null);
  const [editingClient, setEditingClient] = useState(false);

  // Edit mode: contract PDF, fetched with the reservation; (re)generated on demand.
  const [contractPdfUrl, setContractPdfUrl] = useState<string | null>(null);
  const [generatingContract, setGeneratingContract] = useState(false);

  // Edit mode: security deposit, fetched with the reservation; released or
  // (partially) captured once the trailer comes back.
  const [depositStatus, setDepositStatus] = useState<string>("none");
  const [depositAmountCents, setDepositAmountCents] = useState(0);
  const [depositExpiresAt, setDepositExpiresAt] = useState<string | null>(null);
  const [inspection, setInspection] = useState<PanelInspection>(null);

  // Edit mode: the licence and insurance proof the client uploaded, checked by staff.
  const [documents, setDocuments] = useState<ClientDocument[]>([]);

  // Edit mode: why the client's confirmation e-mail did not go out last time, if it did not.
  const [emailProblem, setEmailProblem] = useState<string | null>(null);

  // Create mode: existing-client search vs. quick-create a new one.
  const [clientMode, setClientMode] = useState<"search" | "new">("search");
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [newClient, setNewClient] = useState({
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    phone: "",
    billingAddress: "",
    billingCity: "",
    billingProvince: "Québec",
    billingPostalCode: "",
  });

  useEffect(() => {
    if (state.mode !== "edit") return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/reservations/${state.reservationId}`);
      if (!res.ok) {
        if (!cancelled) setError("Impossible de charger la réservation");
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setTrailerId(data.trailerId ?? "");
      setPickupDate(data.pickupDate ? data.pickupDate.slice(0, 10) : "");
      setReturnDate(data.returnDate ? data.returnDate.slice(0, 10) : "");
      setTotalAmountDollars((data.totalAmount / 100).toFixed(2));
      setStatus(data.status);
      setNote(data.note ?? "");
      setPickupTime(data.pickupTime ?? "");
      setReturnTime(data.returnTime ?? "");
      setIsTest(Boolean(data.isTest));
      setDeliveryOption((data.deliveryOption ?? "pickup") as DeliveryOption);
      setUsageLocation(data.usageLocation ?? "");
      setDeliveryFeeDollars(data.deliveryFeeCents ? (data.deliveryFeeCents / 100).toFixed(2) : "");
      setDeliveryKm(data.deliveryDistanceKm ?? null);
      setClientDisplay(data.client);
      setDocuments(data.documents ?? []);
      setContractPdfUrl(data.contract?.pdfUrl ?? null);
      setEmailProblem(data.confirmationEmailProblem ?? null);
      setDepositStatus(data.depositStatus ?? "none");
      setDepositAmountCents(data.depositAmount ?? 0);
      setDepositExpiresAt(data.depositExpiresAt ?? null);
      setInspection(
        data.returnInspection
          ? {
              status: data.returnInspection.status,
              photoPaths: data.returnInspection.photoPaths ?? [],
              notes: data.returnInspection.notes ?? null,
            }
          : null,
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  async function handleGenerateContract() {
    if (state.mode !== "edit") return;
    setError(null);
    setGeneratingContract(true);
    try {
      const res = await fetch(`/api/admin/reservations/${state.reservationId}/contract`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Impossible de générer le contrat");
        return;
      }
      setContractPdfUrl(data.pdfUrl);
    } finally {
      setGeneratingContract(false);
    }
  }

  function handlePanelChange(patch: PanelChange) {
    if (patch.reservationStatus !== undefined) {
      setStatus(patch.reservationStatus);
      router.refresh();
    }
    if (patch.depositStatus !== undefined) setDepositStatus(patch.depositStatus);
    if (patch.depositAmountCents !== undefined) setDepositAmountCents(patch.depositAmountCents);
    if (patch.depositExpiresAt !== undefined) setDepositExpiresAt(patch.depositExpiresAt);
    if (patch.inspection !== undefined) setInspection(patch.inspection);
  }

  // Live-suggest the total based on the tiered rate table whenever trailer/dates
  // change in create mode — still fully editable afterward. Computed directly
  // from the change handlers (not an effect) since it's a one-shot default,
  // not a continuous sync with an external system.
  const deliveryFeeCents = deliveryOption === "pickup" ? 0 : toCents(deliveryFeeDollars);

  function suggestTotal(nextTrailerId: string, nextPickup: string, nextReturn: string, feeCents = deliveryFeeCents) {
    if (state.mode !== "create") return;
    if (!nextTrailerId || !nextPickup || !nextReturn || nextReturn <= nextPickup) return;
    const size = trailers.find((t) => t.id === nextTrailerId)?.size as TrailerSize | undefined;
    if (!size) return;
    const cents = computeTotalCents(size, nextPickup, nextReturn) + feeCents;
    setTotalAmountDollars((cents / 100).toFixed(2));
  }

  function changeDeliveryOption(next: DeliveryOption) {
    setDeliveryOption(next);
    if (next === "pickup") {
      setDeliveryFeeDollars("");
      suggestTotal(trailerId, pickupDate, returnDate, 0);
    }
  }

  useEffect(() => {
    if (clientMode !== "search" || clientQuery.trim().length < 2) {
      const clear = setTimeout(() => setClientResults([]), 0);
      return () => clearTimeout(clear);
    }
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/admin/clients/search?q=${encodeURIComponent(clientQuery)}`);
      if (res.ok) setClientResults(await res.json());
    }, 300);
    return () => clearTimeout(timeout);
  }, [clientQuery, clientMode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (returnDate <= pickupDate) {
      setError("La date de retour doit être après la date de ramassage");
      return;
    }

    const totalAmount = Math.round(parseFloat(totalAmountDollars || "0") * 100);
    const transport = { deliveryOption, usageLocation, deliveryFeeCents };
    setNotice(null);
    setSubmitting(true);
    try {
      if (state.mode === "edit") {
        const res = await fetch(`/api/admin/reservations/${state.reservationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            pickupDate,
            returnDate,
            trailerId,
            totalAmount,
            note,
            pickupTime,
            returnTime,
            isTest,
            ...transport,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Impossible d'enregistrer");
          return;
        }
        // An unsigned contract is made again by the server. These two cases need a person: stay open and say so.
        if (data.contractRefresh === "signed_outdated") {
          setNotice("Enregistré. Attention : le contrat signé par le client ne correspond plus à ces nouvelles conditions; il faudra le lui faire signer de nouveau.");
          router.refresh();
          return;
        }
        if (data.contractRefresh === "cleared") {
          setContractPdfUrl(null);
          setNotice("Enregistré. Le contrat n'a pas pu être refait automatiquement : cliquez sur « Générer le contrat (PDF) ».");
          router.refresh();
          return;
        }
      } else {
        let clientId = selectedClient?.id;
        if (clientMode === "new") {
          const clientRes = await fetch("/api/admin/clients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newClient),
          });
          const clientData = await clientRes.json();
          if (!clientRes.ok) {
            setError(clientData.error ?? "Impossible de créer le client");
            return;
          }
          clientId = clientData.id;
        }
        if (!clientId) {
          setError("Sélectionnez ou créez un client");
          return;
        }

        const res = await fetch("/api/admin/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            trailerId,
            pickupDate,
            returnDate,
            totalAmount,
            status,
            note,
            pickupTime,
            returnTime,
            isTest,
            ...transport,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Impossible de créer la réservation");
          return;
        }
      }

      router.refresh();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (state.mode !== "edit") return;
    if (!(await confirm("Annuler cette réservation ?", { confirmLabel: "Annuler la réservation", cancelLabel: "Retour", danger: true }))) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reservations/${state.reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible d'annuler");
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        {...dialogProps}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div id={titleId} className="font-heading text-lg">
              {state.mode === "edit" ? "Modifier la réservation" : "Nouvelle réservation"}
            </div>
            {state.mode === "edit" && role === "owner" && (
              <Link href={`/dashboard/journal?reservation=${state.reservationId}`} className="text-[12px] text-navy underline">
                Historique de cette réservation
              </Link>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="text-[13px] text-muted">Chargement...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {state.mode === "edit" && clientDisplay && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-border-light bg-subtle p-3 text-[13px]">
                <div>
                  <div className="font-medium">
                    {clientDisplay.firstName} {clientDisplay.lastName}
                  </div>
                  <div className="text-muted">
                    {clientDisplay.email} · {clientDisplay.phone}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingClient(true)}
                  className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[12px] hover:bg-hover"
                >
                  Modifier
                </button>
              </div>
            )}

            {state.mode === "edit" && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-border-light bg-subtle p-3 text-[13px]">
                <div>
                  <div className="font-medium">Contrat de location</div>
                  {contractPdfUrl ? (
                    <a
                      href={contractPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-navy underline"
                    >
                      Voir le PDF
                    </a>
                  ) : (
                    <div className="text-muted">Aucun contrat généré.</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleGenerateContract}
                  disabled={generatingContract}
                  className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[12px] hover:bg-hover disabled:opacity-50"
                >
                  {generatingContract ? "..." : contractPdfUrl ? "Régénérer le PDF" : "Générer le contrat (PDF)"}
                </button>
              </div>
            )}

            {state.mode === "edit" && role === "owner" && holdsSlot(status) && !isTest && clientDisplay && (
              <QuickBooksInvoicePanel
                reservationId={state.reservationId}
                clientName={`${clientDisplay.firstName} ${clientDisplay.lastName}`}
              />
            )}

            {state.mode === "edit" && holdsSlot(status) && clientDisplay && (
              <ConfirmationEmailPanel reservationId={state.reservationId} clientEmail={clientDisplay.email} problem={emailProblem} />
            )}

            {state.mode === "edit" && <ClientDocumentsPanel documents={documents} reservationId={state.reservationId} />}

            {state.mode === "edit" && (
              <DepositInspectionPanel
                reservationId={state.reservationId}
                role={role}
                reservationStatus={status}
                returnDate={returnDate}
                depositStatus={depositStatus}
                depositAmountCents={depositAmountCents}
                depositExpiresAt={depositExpiresAt}
                inspection={inspection}
                onChange={handlePanelChange}
              />
            )}

            <fieldset disabled={role === "employee"} className="m-0 min-w-0 border-0 p-0">

            {state.mode === "create" && (
              <div className="mb-3">
                <div className="mb-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setClientMode("search")}
                    aria-pressed={clientMode === "search"}
                    className={`rounded-md border px-3 py-1.5 text-[12px] ${
                      clientMode === "search" ? "border-navy bg-tint" : "border-border bg-white"
                    }`}
                  >
                    Client existant
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode("new")}
                    aria-pressed={clientMode === "new"}
                    className={`rounded-md border px-3 py-1.5 text-[12px] ${
                      clientMode === "new" ? "border-navy bg-tint" : "border-border bg-white"
                    }`}
                  >
                    Nouveau client
                  </button>
                </div>

                {clientMode === "search" ? (
                  <div>
                    <Input
                      value={selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : clientQuery}
                      onChange={(e) => {
                        setSelectedClient(null);
                        setClientQuery(e.target.value);
                      }}
                      placeholder="Rechercher par nom ou courriel..."
                    />
                    {clientResults.length > 0 && !selectedClient && (
                      <div className="mt-1 rounded-md border border-border-light">
                        {clientResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedClient(c);
                              setClientResults([]);
                            }}
                            className="block w-full border-b border-border-light px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-page"
                          >
                            {c.firstName} {c.lastName} <span className="text-muted">— {c.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Prénom"
                      value={newClient.firstName}
                      onChange={(e) => setNewClient((c) => ({ ...c, firstName: e.target.value }))}
                    />
                    <Input
                      placeholder="Nom"
                      value={newClient.lastName}
                      onChange={(e) => setNewClient((c) => ({ ...c, lastName: e.target.value }))}
                    />
                    <Input
                      placeholder="Entreprise (optionnel)"
                      className="col-span-2"
                      value={newClient.company}
                      onChange={(e) => setNewClient((c) => ({ ...c, company: e.target.value }))}
                    />
                    <Input
                      placeholder="Courriel"
                      type="email"
                      value={newClient.email}
                      onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))}
                    />
                    <Input
                      placeholder="Téléphone"
                      value={newClient.phone}
                      onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))}
                    />
                    <Input
                      placeholder="Adresse (facturation)"
                      className="col-span-2"
                      value={newClient.billingAddress}
                      onChange={(e) => setNewClient((c) => ({ ...c, billingAddress: e.target.value }))}
                    />
                    <Input
                      placeholder="Ville"
                      value={newClient.billingCity}
                      onChange={(e) => setNewClient((c) => ({ ...c, billingCity: e.target.value }))}
                    />
                    <Input
                      placeholder="Province"
                      value={newClient.billingProvince}
                      onChange={(e) => setNewClient((c) => ({ ...c, billingProvince: e.target.value }))}
                    />
                    <Input
                      placeholder="Code postal"
                      className="col-span-2"
                      value={newClient.billingPostalCode}
                      onChange={(e) => setNewClient((c) => ({ ...c, billingPostalCode: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            )}

            <Field label="Remorque">
              <select
                value={trailerId}
                onChange={(e) => {
                  setTrailerId(e.target.value);
                  suggestTotal(e.target.value, pickupDate, returnDate);
                }}
                className="w-full rounded-md border border-border px-3 py-2.5 text-[13px]"
                required
              >
                <option value="" disabled>
                  Choisir...
                </option>
                {trailers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.number} — {t.name} ({t.size})
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date de ramassage">
                <Input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => {
                    setPickupDate(e.target.value);
                    suggestTotal(trailerId, e.target.value, returnDate);
                  }}
                  required
                />
              </Field>
              <Field label="Date de retour">
                <Input
                  type="date"
                  value={returnDate}
                  onChange={(e) => {
                    setReturnDate(e.target.value);
                    suggestTotal(trailerId, pickupDate, e.target.value);
                  }}
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Heure de ramassage">
                <Input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
              </Field>
              <Field label="Heure de retour">
                <Input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />
              </Field>
            </div>

            <Field label="Transport">
              <select
                value={deliveryOption}
                onChange={(e) => changeDeliveryOption(e.target.value as DeliveryOption)}
                className="w-full rounded-md border border-border px-3 py-2.5 text-[13px]"
              >
                {DELIVERY_OPTION.map((option) => (
                  <option key={option} value={option}>
                    {DELIVERY_OPTION_LABEL_FR[option]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={deliveryOption === "pickup" ? "Lieu d'utilisation (facultatif)" : "Adresse de livraison"}>
              <Input
                value={usageLocation}
                onChange={(e) => setUsageLocation(e.target.value)}
                placeholder="Numéro, rue, ville"
                maxLength={200}
                required={deliveryOption !== "pickup"}
              />
            </Field>

            {deliveryOption !== "pickup" && (
              <>
                <Field label="Frais de transport ($, avant taxes)">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={deliveryFeeDollars}
                    onChange={(e) => {
                      setDeliveryFeeDollars(e.target.value);
                      suggestTotal(trailerId, pickupDate, returnDate, toCents(e.target.value));
                    }}
                  />
                </Field>
                <p className={`-mt-1 mb-3 text-[12px] ${deliveryFeeCents > toCents(totalAmountDollars) ? "text-red-600" : "text-muted"}`}>
                  {deliveryFeeCents > toCents(totalAmountDollars)
                    ? "Les frais de transport dépassent le montant total."
                    : `Le montant total comprend le transport : location ${money(toCents(totalAmountDollars) - deliveryFeeCents)} + transport ${money(deliveryFeeCents)}${deliveryKm !== null ? ` (${deliveryKm} km depuis Lévis)` : ""}.`}
                </p>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Montant total ($)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmountDollars}
                  onChange={(e) => setTotalAmountDollars(e.target.value)}
                  required
                />
              </Field>
              <Field label="Statut">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-2.5 text-[13px]"
                >
                  {RESERVATION_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL_FR[s]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Note">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-navy"
              />
            </Field>

            <label className="mb-3 flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
              Réservation test (exclue des statistiques)
            </label>
            </fieldset>

            {error && <div role="alert" className="mb-3 text-[13px] text-red-600">{error}</div>}
            {notice && (
              <div role="status" className="mb-3 rounded-md border border-warn-line bg-warn-soft p-2 text-[13px] text-warn-text">
                {notice}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              {state.mode === "edit" && role === "owner" ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-[13px] text-red-600 hover:underline disabled:opacity-50"
                >
                  {deleting ? "..." : "Supprimer"}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" onClick={onClose}>
                  Annuler
                </Button>
                {role === "owner" && (
                  <Button type="submit" variant="cta" disabled={submitting}>
                    {submitting ? "..." : "Enregistrer"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>

    {editingClient && clientDisplay && (
      <ClientModal
        clientId={clientDisplay.id}
        onClose={() => setEditingClient(false)}
        onSaved={(updated) => {
          setClientDisplay(updated);
          router.refresh();
        }}
      />
    )}
    {dialog}
    </>
  );
}
