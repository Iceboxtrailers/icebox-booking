"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { addDays, fmt } from "@/lib/dates";
import { FLEX_WINDOW_DAYS } from "@/lib/constants";
import { catalogueFor } from "@/lib/catalogue";
import type { DateRangeType, TrailerSize } from "@/lib/constants";

const SIZE_OPTIONS: TrailerSize[] = ["5x10", "6x12"];

export function TrailerDateForm({
  reservationId,
  initial,
}: {
  reservationId: string;
  initial: { size: TrailerSize; dateRangeType: DateRangeType; start: string; end: string };
}) {
  const router = useRouter();
  const [size, setSize] = useState<TrailerSize>(initial.size);
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>(initial.dateRangeType);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = Boolean(start && end);
  const meta = catalogueFor(size);

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
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible d'enregistrer");
        return;
      }
      const qs = new URLSearchParams({ size }).toString();
      router.push(`/reservation/${reservationId}/disponibilites?${qs}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Format de remorque</span>
      <div className="mb-1.5 flex gap-2">
        {SIZE_OPTIONS.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setSize(s)}
            className={`rounded-md border px-4 py-2.5 text-[13px] ${
              size === s ? "border-navy bg-[#E4EEF4]" : "border-border bg-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {meta && (
        <div className="mb-3.5 text-[12px] text-muted">
          Plage de température : {meta.tempRangeLabel} · {meta.description}
        </div>
      )}

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
