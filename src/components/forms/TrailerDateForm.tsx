"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { addDays, fmt } from "@/lib/dates";
import { DELIVERY_OPTION, DELIVERY_OPTION_LABEL_FR, FLEX_WINDOW_DAYS, deliveryTrips } from "@/lib/constants";
import type { DateRangeType, DeliveryOption } from "@/lib/constants";

export function TrailerDateForm({
  reservationId,
  initial,
}: {
  reservationId: string;
  initial: {
    dateRangeType: DateRangeType;
    start: string;
    end: string;
    usageLocation: string;
    deliveryOption: DeliveryOption;
  };
}) {
  const router = useRouter();
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>(initial.dateRangeType);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [usageLocation, setUsageLocation] = useState(initial.usageLocation);
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>(initial.deliveryOption);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsTransport = deliveryTrips(deliveryOption) > 0;
  const canSubmit = Boolean(start && end && usageLocation.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (end <= start) {
      setError("La date de retour doit être après la date de ramassage");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRangeType,
          pickupDate: start,
          returnDate: end,
          flexWindowDays: dateRangeType === "flexible" ? FLEX_WINDOW_DAYS : 0,
          usageLocation,
          deliveryOption,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible d'enregistrer");
        return;
      }
      router.push(`/reservation/${reservationId}/disponibilites`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Type de plage</span>
      <div className="mb-3.5 flex gap-2">
        <button
          type="button"
          onClick={() => setDateRangeType("fixed")}
          className={`rounded-md border px-4 py-2.5 text-[13px] ${
            dateRangeType === "fixed" ? "border-navy bg-[#E4EEF4]" : "border-border bg-white"
          }`}
        >
          Dates fixes
        </button>
        <button
          type="button"
          onClick={() => setDateRangeType("flexible")}
          className={`rounded-md border px-4 py-2.5 text-[13px] ${
            dateRangeType === "flexible" ? "border-navy bg-[#E4EEF4]" : "border-border bg-white"
          }`}
        >
          Flexible (±{FLEX_WINDOW_DAYS} jours)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date de ramassage souhaitée">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
        <Field label="Date de retour souhaitée">
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </Field>
      </div>

      {dateRangeType === "flexible" && start && (
        <div className="mb-3 text-[12px] text-muted">
          Le site cherchera aussi des disponibilités entre {fmt(addDays(start, -FLEX_WINDOW_DAYS))} et{" "}
          {fmt(addDays(start, FLEX_WINDOW_DAYS))}.
        </div>
      )}

      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Ramassage ou livraison</span>
      <div className="mb-2 flex flex-wrap gap-2">
        {DELIVERY_OPTION.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDeliveryOption(option)}
            className={`rounded-md border px-4 py-2.5 text-[13px] ${
              deliveryOption === option ? "border-navy bg-[#E4EEF4]" : "border-border bg-white"
            }`}
          >
            {DELIVERY_OPTION_LABEL_FR[option]}
          </button>
        ))}
      </div>
      {needsTransport && (
        <div className="mb-3 text-[12px] text-muted">
          Les frais de transport sont calculés automatiquement selon la distance depuis Lévis (
          {deliveryTrips(deliveryOption) === 2 ? "livraison et récupération" : "un seul trajet"}) et affichés à
          l&apos;étape suivante.
        </div>
      )}

      <Field label={needsTransport ? "Adresse de livraison / récupération" : "Lieu d'utilisation"}>
        <Input
          value={usageLocation}
          onChange={(e) => setUsageLocation(e.target.value)}
          placeholder={
            needsTransport ? "Numéro, rue, ville (adresse complète)" : "Adresse où la remorque sera utilisée"
          }
          required
        />
      </Field>

      {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}

      <div className="mt-4 flex justify-between">
        <Button type="button" onClick={() => router.push("/")}>
          Précédent
        </Button>
        <Button type="submit" variant="cta" disabled={!canSubmit || submitting}>
          {submitting ? "..." : "Suivant"}
        </Button>
      </div>
    </form>
  );
}
