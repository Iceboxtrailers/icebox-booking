import Image from "next/image";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { buttonClassName } from "@/components/ui/Button";
import { CATALOGUE, INCLUDED_WITH_RENTAL } from "@/lib/catalogue";
import type { TrailerSize } from "@/lib/constants";
import { RATE_TABLE, TRANSPORT_FEE_PER_TRIP_CENTS, TRANSPORT_FEE_PER_KM_BEYOND_CENTS } from "@/lib/pricing";

// One real photo per model (one axle = 5x10, two axles = 6x12).
const MODEL_PHOTOS: Record<TrailerSize, { src: string; alt: string }> = {
  "5x10": {
    src: "/photos/remorque-5x10-avant.jpg",
    alt: "Remorque ICEBOX 5×10 à un essieu, vue de trois quarts avec le groupe frigorifique et l'attelage",
  },
  "6x12": {
    src: "/photos/remorque-6x12-cote.jpg",
    alt: "Remorque ICEBOX 6×12 à deux essieux, vue de côté",
  },
};

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

// "150" or "1 300" (French thousands separator) for the prices shown in the cards.
const dollarFormat = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 });
function dollars(cents: number) {
  return dollarFormat.format(cents / 100);
}

export function ModelsSection() {
  return (
    <section id="remorques" className="mb-14 scroll-mt-6">
      <h2 className="font-heading mb-1 text-xl">Nos remorques</h2>
      <p className="mb-5 text-[13px] text-muted">
        Prix avant taxes. Le meilleur tarif (jour, semaine ou mois) est appliqué automatiquement à vos dates.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CATALOGUE.map((item) => {
          const rate = RATE_TABLE[item.size];
          return (
            <Card key={item.size} className="flex flex-col overflow-hidden">
              <div className="relative aspect-[5/4] w-full bg-subtle">
                <Image
                  src={MODEL_PHOTOS[item.size].src}
                  alt={MODEL_PHOTOS[item.size].alt}
                  fill
                  sizes="(min-width: 1024px) 490px, (min-width: 640px) 45vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <div className="font-heading text-2xl">{item.size.replace("x", "×")}</div>
                  <div className="tabular-nums text-[12px] text-muted">{item.tempRangeLabel}</div>
                </div>
                <div className="mb-4 text-[13px] text-muted">{item.idealFor}</div>

                <dl className="mb-5 space-y-1.5 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Intérieur</dt>
                    <dd className="tabular-nums">{item.interiorDimensions}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Alimentation</dt>
                    <dd>120 V</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Poids approximatif</dt>
                    <dd className="tabular-nums">{item.approxWeightLb.toLocaleString("fr-CA")} lb</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Main de remorque</dt>
                    <dd className="tabular-nums">{item.hitchLabel}</dd>
                  </div>
                </dl>

                <div className="mt-auto">
                  <div className="tabular-nums">
                    <span className="text-[13px] text-muted">dès </span>
                    <span className="text-2xl font-semibold">{dollars(rate.dayCents)} $</span>
                    <span className="text-[13px] text-muted"> / jour</span>
                  </div>
                  <div className="mb-4 tabular-nums text-[12px] text-muted">
                    {dollars(rate.weekCents)} $ / semaine · {dollars(rate.monthCents)} $ / mois
                  </div>
                  <a href="#disponibilites" className={buttonClassName("cta", "md", "w-full justify-center")}>
                    Choisir mes dates
                  </a>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-border-light bg-subtle px-5 py-4">
        <div className="mb-2 text-[13px] font-semibold">Inclus dans chaque location</div>
        <ul className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2 md:grid-cols-3">
          {INCLUDED_WITH_RENTAL.map((label) => (
            <li key={label} className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-navy" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <details className="group mt-6">
        <summary className="cursor-pointer py-2 text-[13px] font-medium text-navy hover:underline">
          Voir la grille tarifaire complète
        </summary>
        <div id="tarification" className="mt-4 scroll-mt-6">
          <div className="mb-6 overflow-x-auto rounded-lg border border-border-light">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-subtle text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Période</th>
                  {CATALOGUE.map((item) => (
                    <th key={item.size} className="px-4 py-2.5 font-medium">
                      {item.size}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Jour (24 heures)", "dayCents"],
                    ["Semaine (7 jours)", "weekCents"],
                    ["Mois (30 jours)", "monthCents"],
                  ] as const
                ).map(([label, key]) => (
                  <tr key={key} className="border-t border-border-light">
                    <td className="px-4 py-2.5 text-muted">{label}</td>
                    {CATALOGUE.map((item) => (
                      <td key={item.size} className="px-4 py-2.5 tabular-nums">
                        {money(RATE_TABLE[item.size][key])} $
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Card className="p-4 text-[13px]">
            <div className="mb-1 font-medium">Transport (livraison et récupération)</div>
            <div className="text-muted">
              {money(TRANSPORT_FEE_PER_TRIP_CENTS)} $ / aller, 50 km maximum inclus —{" "}
              {money(TRANSPORT_FEE_PER_KM_BEYOND_CENTS)} $ / km supplémentaire.
            </div>
          </Card>

          <p className="mt-4 text-[11px] text-muted">
            Prix avant taxes. Un dépôt de sécurité est requis à la réservation. Le client est responsable du
            chargement et du déchargement; un nettoyage est requis au retour. Des frais supplémentaires peuvent
            s&apos;appliquer en cas de dommages ou de retards.
          </p>
        </div>
      </details>
    </section>
  );
}
