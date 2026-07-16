"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fmt } from "@/lib/dates";
import { TRAILER_TYPE_LABEL_FR, type TrailerType } from "@/lib/constants";
import type { AvailabilityCandidate } from "@/lib/availability";

export function AvailabilityList({
  reservationId,
  candidates,
}: {
  reservationId: string;
  candidates: AvailabilityCandidate[];
}) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleNext() {
    if (selectedIndex === null) return;
    const chosen = candidates[selectedIndex];
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trailerId: chosen.trailerId,
          pickupDate: chosen.windowStart,
          returnDate: chosen.windowEnd,
          totalAmount: chosen.totalCents,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible d'enregistrer votre sélection");
        return;
      }
      router.push(`/reservation/${reservationId}/documents`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-3.5 text-[13px] text-muted">
        Remorques disponibles pour votre demande :
      </div>

      {candidates.length === 0 && (
        <div className="text-[13px] text-muted">
          Aucune disponibilité trouvée pour ces dates. Revenez à l&apos;étape précédente pour ajuster votre
          demande.
        </div>
      )}

      {candidates.map((c, i) => {
        const chosen = selectedIndex === i;
        return (
          <div
            key={`${c.trailerId}-${c.windowStart}`}
            onClick={() => setSelectedIndex(i)}
            className={`mb-2.5 flex cursor-pointer items-center gap-3.5 rounded-[10px] border p-3.5 ${
              chosen ? "border-2 border-navy" : "border-border-light"
            }`}
          >
            <Truck size={22} className="text-navy" />
            <div className="flex-1">
              <div className="text-sm font-medium">
                {TRAILER_TYPE_LABEL_FR[c.type as TrailerType] ?? c.type} {c.size}{" "}
                <span className="text-xs font-normal text-muted">({c.tempRange})</span>
              </div>
              <div className="text-xs text-muted">
                {fmt(c.windowStart)} → {fmt(c.windowEnd)} · {c.nights} jour(s)
              </div>
            </div>
            <div className="font-mono font-medium">{(c.dailyRateCents / 100).toFixed(2)} $/jour</div>
            {chosen && <CheckCircle2 size={18} className="text-navy" />}
          </div>
        );
      })}

      {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}

      <div className="mt-4 flex justify-between">
        <Button type="button" onClick={() => router.back()}>
          Précédent
        </Button>
        <Button type="button" variant="cta" disabled={selectedIndex === null || submitting} onClick={handleNext}>
          {submitting ? "..." : "Suivant"}
        </Button>
      </div>
    </div>
  );
}
