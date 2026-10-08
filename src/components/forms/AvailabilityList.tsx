"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fmt } from "@/lib/dates";
import { computeTaxBreakdown } from "@/lib/pricing";
import type { AvailabilityCandidate } from "@/lib/availability";
import type { TrailerSize } from "@/lib/constants";

type TempNeed = "refrigerated" | "frozen";
type VolumeNeed = "small" | "large";

// Only 6x12 goes below +2°C, so a freezing need settles the choice outright
// (catalogue.ts tempRangeLabel) — volume only matters when either size would
// keep the requested temperature. The volume options are the catalogue's own
// marketing copy, not invented capacity numbers.
function recommendSize(tempNeed: TempNeed | null, volumeNeed: VolumeNeed | null): TrailerSize | null {
  if (tempNeed === "frozen") return "6x12";
  if (tempNeed === "refrigerated" && volumeNeed) return volumeNeed === "small" ? "5x10" : "6x12";
  return null;
}

export function AvailabilityList({
  reservationId,
  candidates,
  deliveryFeeCents,
  deliveryDistanceKm,
  deliveryTrips,
}: {
  reservationId: string;
  candidates: AvailabilityCandidate[];
  deliveryFeeCents: number;
  deliveryDistanceKm: number | null;
  deliveryTrips: number;
}) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [helperOpen, setHelperOpen] = useState(false);
  const [tempNeed, setTempNeed] = useState<TempNeed | null>(null);
  const [volumeNeed, setVolumeNeed] = useState<VolumeNeed | null>(null);
  const recommendedSize = recommendSize(tempNeed, volumeNeed);

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
      <div className="mb-1 text-[13px] text-muted">
        Remorques disponibles pour votre demande :
      </div>
      <div className="mb-3.5 flex items-center gap-1.5 text-[12px] text-navy">
        <Sparkles size={13} /> Meilleur tarif appliqué automatiquement
      </div>

      <div className="mb-3.5 rounded-lg border border-border-light bg-[#FAFBFB] p-3.5">
        <button
          type="button"
          onClick={() => setHelperOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[13px] font-medium text-navy"
        >
          <Sparkles size={14} /> Je ne sais pas laquelle choisir
        </button>
        {helperOpen && (
          <div className="mt-3 space-y-3">
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-foreground">Quelle température vous faut-il ?</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTempNeed("refrigerated")}
                  className={`rounded-md border px-3 py-1.5 text-[12px] ${
                    tempNeed === "refrigerated" ? "border-navy bg-[#E4EEF4]" : "border-border bg-white"
                  }`}
                >
                  Entre 2 °C et 15 °C (réfrigéré)
                </button>
                <button
                  type="button"
                  onClick={() => setTempNeed("frozen")}
                  className={`rounded-md border px-3 py-1.5 text-[12px] ${
                    tempNeed === "frozen" ? "border-navy bg-[#E4EEF4]" : "border-border bg-white"
                  }`}
                >
                  Sous 0 °C, jusqu&apos;à -18 °C (congelé)
                </button>
              </div>
            </div>

            {tempNeed === "refrigerated" && (
              <div>
                <div className="mb-1.5 text-[12px] font-medium text-foreground">Quel volume ?</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setVolumeNeed("small")}
                    className={`rounded-md border px-3 py-1.5 text-[12px] ${
                      volumeNeed === "small" ? "border-navy bg-[#E4EEF4]" : "border-border bg-white"
                    }`}
                  >
                    Petit volume — événements, traiteurs, commerces
                  </button>
                  <button
                    type="button"
                    onClick={() => setVolumeNeed("large")}
                    className={`rounded-md border px-3 py-1.5 text-[12px] ${
                      volumeNeed === "large" ? "border-navy bg-[#E4EEF4]" : "border-border bg-white"
                    }`}
                  >
                    Grand volume — industries, distribution
                  </button>
                </div>
              </div>
            )}

            {recommendedSize && (
              <div className="rounded-md bg-[#E4EEF4] p-2.5 text-[12px] text-navy">
                Nous recommandons la remorque <strong>{recommendedSize}</strong>
                {!candidates.some((c) => c.size === recommendedSize) &&
                  " — mais elle n'est pas disponible pour ces dates."}
              </div>
            )}
          </div>
        )}
      </div>

      {candidates.length === 0 && (
        <div className="mb-3.5 rounded-lg border border-border-light bg-[#FAFBFB] p-3.5 text-[13px] text-foreground">
          Aucune disponibilité trouvée pour ces dates. Communiquez directement avec IceBox pour vérifier les
          options : <a href="mailto:info@iceboxtrailers.ca" className="text-navy underline">info@iceboxtrailers.ca</a>{" "}
          ou par téléphone au <a href="tel:+15818892093" className="text-navy underline">581 889-2093</a>. Vous
          pouvez aussi revenir à l&apos;étape précédente pour ajuster vos dates.
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
              <div className="flex items-center gap-1.5 text-sm font-medium">
                Remorque {c.size} <span className="text-xs font-normal text-muted">({c.tempRangeLabel})</span>
                {recommendedSize === c.size && (
                  <span className="rounded-full bg-[#E4EEF4] px-2 py-0.5 text-[10px] font-medium text-navy">
                    Recommandée pour vous
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">
                {fmt(c.windowStart)} → {fmt(c.windowEnd)} · {c.nights} jour(s)
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-medium">{((c.totalCents + deliveryFeeCents) / 100).toFixed(2)} $</div>
              <div className="font-mono text-[10px] text-muted">
                {(computeTaxBreakdown(c.totalCents + deliveryFeeCents).totalWithTaxCents / 100).toFixed(2)} $ taxes
                incl.
              </div>
            </div>
            {chosen && <CheckCircle2 size={18} className="text-navy" />}
          </div>
        );
      })}

      {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}

      {deliveryFeeCents > 0 && (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-border-light bg-[#FAFBFB] p-3 text-[12px] text-foreground">
          <Truck size={14} className="shrink-0 text-navy" />
          <span>
            Transport inclus dans les prix ci-dessus :{" "}
            <strong className="font-mono">{(deliveryFeeCents / 100).toFixed(2)} $</strong>
            {deliveryDistanceKm !== null &&
              ` (${deliveryDistanceKm} km depuis Lévis, ${deliveryTrips} trajet${deliveryTrips > 1 ? "s" : ""})`}
            .
          </span>
        </div>
      )}

      <div className="mb-4 text-[11px] text-muted">
        Prix avant taxes.{" "}
        {deliveryFeeCents === 0 && "Des frais de transport s'ajoutent si vous choisissez la livraison. "}
        Pour les demandes de dernière minute, des frais d&apos;urgence peuvent s&apos;appliquer en sus — voir
        les détails sur la page{" "}
        <Link href="/#tarification" className="text-navy underline">
          tarification
        </Link>
        .
      </div>

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
