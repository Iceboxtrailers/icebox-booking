"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { computeTotalCents } from "@/lib/pricing";
import { RESERVATION_STATUS } from "@/lib/constants";
import type { TrailerSize } from "@/lib/constants";

type ModalState =
  | { mode: "edit"; reservationId: string }
  | { mode: "create"; trailerId: string; pickupDate: string };

type TrailerOption = { id: string; name: string; size: string };
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

export function ReservationModal({
  state,
  trailers,
  onClose,
}: {
  state: ModalState;
  trailers: TrailerOption[];
  onClose: () => void;
}) {
  const router = useRouter();
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

  // Edit mode: read-only client display, fetched with the reservation.
  const [clientDisplay, setClientDisplay] = useState<ClientOption | null>(null);

  // Create mode: existing-client search vs. quick-create a new one.
  const [clientMode, setClientMode] = useState<"search" | "new">("search");
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [newClient, setNewClient] = useState({ firstName: "", lastName: "", email: "", phone: "" });

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
      setClientDisplay(data.client);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  // Live-suggest the total based on the tiered rate table whenever trailer/dates
  // change in create mode — still fully editable afterward. Computed directly
  // from the change handlers (not an effect) since it's a one-shot default,
  // not a continuous sync with an external system.
  function suggestTotal(nextTrailerId: string, nextPickup: string, nextReturn: string) {
    if (state.mode !== "create") return;
    if (!nextTrailerId || !nextPickup || !nextReturn || nextReturn <= nextPickup) return;
    const size = trailers.find((t) => t.id === nextTrailerId)?.size as TrailerSize | undefined;
    if (!size) return;
    const cents = computeTotalCents(size, nextPickup, nextReturn);
    setTotalAmountDollars((cents / 100).toFixed(2));
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
    setSubmitting(true);
    try {
      if (state.mode === "edit") {
        const res = await fetch(`/api/admin/reservations/${state.reservationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, pickupDate, returnDate, trailerId, totalAmount }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Impossible d'enregistrer");
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
          body: JSON.stringify({ clientId, trailerId, pickupDate, returnDate, totalAmount, status }),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-lg">
            {state.mode === "edit" ? "Modifier la réservation" : "Nouvelle réservation"}
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="text-[13px] text-muted">Chargement...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {state.mode === "edit" && clientDisplay && (
              <div className="mb-3 rounded-lg border border-border-light bg-[#FAFBFB] p-3 text-[13px]">
                <div className="font-medium">
                  {clientDisplay.firstName} {clientDisplay.lastName}
                </div>
                <div className="text-muted">
                  {clientDisplay.email} · {clientDisplay.phone}
                </div>
              </div>
            )}

            {state.mode === "create" && (
              <div className="mb-3">
                <div className="mb-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setClientMode("search")}
                    className={`rounded-md border px-3 py-1.5 text-[12px] ${
                      clientMode === "search" ? "border-navy bg-[#E4EEF4]" : "border-border bg-white"
                    }`}
                  >
                    Client existant
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode("new")}
                    className={`rounded-md border px-3 py-1.5 text-[12px] ${
                      clientMode === "new" ? "border-navy bg-[#E4EEF4]" : "border-border bg-white"
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
                            className="block w-full border-b border-border-light px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-[#F4F6F7]"
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
                    {t.name} ({t.size})
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

            {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" variant="cta" disabled={submitting}>
                {submitting ? "..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
