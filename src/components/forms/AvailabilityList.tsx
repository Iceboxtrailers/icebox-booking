"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/forms/FormError";
import { apiErrorMessage } from "@/lib/api-client";
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
  const captionId = useId();
  const tempQuestionId = useId();
  const volumeQuestionId = useId();
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
        }),
      });
      if (!res.ok) {
        setError(await apiErrorMessage(res, "Impossible d'enregistrer votre sélection"));
        return;
      }
      router.push(`/reservation/${reservationId}/documents`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div id={captionId} className="mb-1 text-[13px] text-muted">
        Remorques disponibles pour votre demande :
      </div>
      <div className="mb-3.5 flex items-center gap-1.5 text-[12px] text-navy">
        <Sparkles size={13} /> Meilleur tarif appliqué automatiquement
      </div>

      <div className="mb-3.5 rounded-lg border border-border-light bg-subtle p-3.5">
        <button
          type="button"
          onClick={() => setHelperOpen((v) => !v)}
          aria-expanded={helperOpen}
          className="flex items-center gap-1.5 py-1.5 text-[13px] font-medium text-navy"
        >
          <Sparkles size={14} /> Je ne sais pas laquelle choisir
        </button>
        {helperOpen && (
          <div className="mt-3 space-y-3">
            <div role="group" aria-labelledby={tempQuestionId}>
              <div id={tempQuestionId} className="mb-1.5 text-[12px] font-medium text-foreground">
                Quelle température vous faut-il ?
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTempNeed("refrigerated")}
                  aria-pressed={tempNeed === "refrigerated"}
                  className={`rounded-md border px-3 py-1.5 text-[12px] ${
                    tempNeed === "refrigerated" ? "border-navy bg-tint" : "border-border bg-white"
                  }`}
                >
                  Entre 2 °C et 15 °C (réfrigéré)
                </button>
                <button
                  type="button"
                  onClick={() => setTempNeed("frozen")}
                  aria-pressed={tempNeed === "frozen"}
                  className={`rounded-md border px-3 py-1.5 text-[12px] ${
                    tempNeed === "frozen" ? "border-navy bg-tint" : "border-border bg-white"
                  }`}
                >
                  Sous 0 °C, jusqu&apos;à -18 °C (congelé)
                </button>
              </div>
            </div>

            {tempNeed === "refrigerated" && (
              <div role="group" aria-labelledby={volumeQuestionId}>
                <div id={volumeQuestionId} className="mb-1.5 text-[12px] font-medium text-foreground">
                  Quel volume ?
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setVolumeNeed("small")}
                    aria-pressed={volumeNeed === "small"}
                    className={`rounded-md border px-3 py-1.5 text-[12px] ${
                      volumeNeed === "small" ? "border-navy bg-tint" : "border-border bg-white"
                    }`}
                  >
                    Petit volume — événements, traiteurs, commerces
                  </button>
                  <button
                    type="button"
                    onClick={() => setVolumeNeed("large")}
                    aria-pressed={volumeNeed === "large"}
                    className={`rounded-md border px-3 py-1.5 text-[12px] ${
                      volumeNeed === "large" ? "border-navy bg-tint" : "border-border bg-white"
                    }`}
                  >
                    Grand volume — industries, distribution
                  </button>
                </div>
              </div>
            )}

            {recommendedSize && (
              <div className="rounded-md bg-tint p-2.5 text-[12px] text-navy">
                Nous recommandons la remorque <strong>{recommendedSize}</strong>
                {!candidates.some((c) => c.size === recommendedSize) &&
                  " — mais elle n'est pas disponible pour ces dates."}
              </div>
            )}
          </div>
        )}
      </div>

      {candidates.length === 0 && (
        <div className="mb-3.5 rounded-lg border border-border-light bg-subtle p-3.5 text-[13px] text-foreground">
          Aucune disponibilité trouvée pour ces dates. Communiquez directement avec IceBox pour vérifier les
          options : <a href="mailto:info@iceboxtrailers.ca" className="text-navy underline">info@iceboxtrailers.ca</a>{" "}
          ou par téléphone au <a href="tel:+15818892093" className="text-navy underline">581 889-2093</a>. Vous
          pouvez aussi revenir à l&apos;étape précédente pour ajuster vos dates.
        </div>
      )}

      {/* Native radios, hidden but focusable: arrow keys move the choice and screen readers hear which one is picked. */}
      {candidates.length > 0 && (
        <div role="radiogroup" aria-labelledby={captionId}>
          {candidates.map((c, i) => {
            const chosen = selectedIndex === i;
            return (
              <label
                key={`${c.trailerId}-${c.windowStart}`}
                className={`mb-2.5 flex cursor-pointer items-center gap-3.5 rounded-[10px] border p-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy ${
                  chosen ? "border-2 border-navy" : "border-border-light"
                }`}
              >
                <input
                  type="radio"
                  name="trailer"
                  checked={chosen}
                  onChange={() => setSelectedIndex(i)}
                  className="sr-only"
                />
                <Truck size={22} className="text-navy" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">
                    Remorque {c.size}{" "}
                    <span className="whitespace-nowrap text-xs font-normal text-muted">({c.tempRangeLabel})</span>
                    {recommendedSize === c.size && (
                      <span className="ml-1.5 inline-block rounded-full bg-tint px-2 py-0.5 text-[10px] font-medium text-navy">
                        Recommandée pour vous
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted">
                    {fmt(c.windowStart)} → {fmt(c.windowEnd)} · {c.nights} jour(s)
                  </span>
                </span>
                <span className="text-right">
                  <span className="block tabular-nums font-medium">
                    {((c.totalCents + deliveryFeeCents) / 100).toFixed(2)} $
                  </span>
                  <span className="block tabular-nums text-[10px] text-muted">
                    {(computeTaxBreakdown(c.totalCents + deliveryFeeCents).totalWithTaxCents / 100).toFixed(2)} $ taxes
                    incl.
                  </span>
                </span>
                {chosen && <CheckCircle2 size={18} className="text-navy" />}
              </label>
            );
          })}
        </div>
      )}

      <FormError message={error} />

      {deliveryFeeCents > 0 && (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-border-light bg-subtle p-3 text-[12px] text-foreground">
          <Truck size={14} className="shrink-0 text-navy" />
          <span>
            Transport inclus dans les prix ci-dessus :{" "}
            <strong className="tabular-nums">{(deliveryFeeCents / 100).toFixed(2)} $</strong>
            {deliveryDistanceKm !== null &&
              ` (${deliveryDistanceKm} km depuis Lévis, ${deliveryTrips} trajet${deliveryTrips > 1 ? "s" : ""})`}
            .
          </span>
        </div>
      )}

      <div className="mb-3 text-[11px] text-muted">
        Une remorque est réservée pour vous à la fin de la réservation, une fois le contrat signé et la carte enregistrée :
        la première personne qui termine l&apos;obtient.
      </div>

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
