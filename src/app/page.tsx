import { MarketingLayout } from "@/components/MarketingLayout";
import { Hero } from "@/components/Hero";
import { Card } from "@/components/ui/Card";
import { CATALOGUE } from "@/lib/catalogue";
import { RATE_TABLE, TRANSPORT_FEE_PER_TRIP_CENTS, TRANSPORT_FEE_PER_KM_BEYOND_CENTS } from "@/lib/pricing";

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

const TRAILER_TAGLINES: Record<string, { headline: string; temp: string }> = {
  "5x10": { headline: "Idéale pour traiteurs, événements et petits volumes", temp: "Réfrigérée" },
  "6x12": { headline: "Pour gros volumes ou congélation", temp: "Réfrigérée/congelée" },
};

export default function HomePage() {
  return (
    <MarketingLayout>
      <Hero />

      <div id="remorques" className="grid scroll-mt-20 grid-cols-1 gap-3 sm:grid-cols-2">
        {CATALOGUE.map((item) => {
          const tag = TRAILER_TAGLINES[item.size];
          return (
            <Card key={item.size} className="p-4">
              <div className="mb-1 text-sm font-medium">
                {item.size} — {tag.headline}
              </div>
              <div className="font-mono text-xs text-muted">
                {tag.temp} • {item.tempRangeLabel} • dès {money(RATE_TABLE[item.size].dayCents)} $/jour
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-muted">
        Meilleur tarif appliqué automatiquement — le système calcule la combinaison jour/semaine/mois la plus
        avantageuse pour vos dates, vous n&apos;avez rien à choisir.
      </p>

      <details className="group mt-8">
        <summary className="cursor-pointer text-[13px] font-medium text-navy hover:underline">
          Voir la grille tarifaire complète
        </summary>
        <section id="tarification" className="mt-4 scroll-mt-6">
          <div className="mb-6 overflow-x-auto rounded-lg border border-border-light">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#FAFBFB] text-muted">
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
                <tr className="border-t border-border-light">
                  <td className="px-4 py-2.5 text-muted">Jour (24 heures)</td>
                  {CATALOGUE.map((item) => (
                    <td key={item.size} className="px-4 py-2.5 font-mono">
                      {money(RATE_TABLE[item.size].dayCents)} $
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-border-light">
                  <td className="px-4 py-2.5 text-muted">Semaine (7 jours)</td>
                  {CATALOGUE.map((item) => (
                    <td key={item.size} className="px-4 py-2.5 font-mono">
                      {money(RATE_TABLE[item.size].weekCents)} $
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-border-light">
                  <td className="px-4 py-2.5 text-muted">Mois (30 jours)</td>
                  {CATALOGUE.map((item) => (
                    <td key={item.size} className="px-4 py-2.5 font-mono">
                      {money(RATE_TABLE[item.size].monthCents)} $
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <Card className="p-4 text-[13px]">
            <div className="mb-1 font-medium">Transport (livraison et récupération)</div>
            <div className="text-muted">
              {money(TRANSPORT_FEE_PER_TRIP_CENTS)} $ / aller, 50 km maximum inclus — {money(TRANSPORT_FEE_PER_KM_BEYOND_CENTS)} $ / km supplémentaire.
            </div>
          </Card>

          <p className="mt-4 text-[11px] text-muted">
            Prix avant taxes. Un dépôt de sécurité est requis à la réservation. Le client est responsable du
            chargement et du déchargement; un nettoyage est requis au retour. Des frais supplémentaires peuvent
            s&apos;appliquer en cas de dommages ou de retards.
          </p>
        </section>
      </details>

      <section className="mt-8 flex flex-col items-center justify-between gap-3 rounded-xl border border-[#F0D9B5] bg-[#FFF8EC] p-5 text-center sm:flex-row sm:text-left">
        <div>
          <div className="font-heading text-base">🚨 Besoin d&apos;une remorque aujourd&apos;hui ?</div>
          <div className="text-[13px] text-muted">Service d&apos;urgence disponible 24/7.</div>
        </div>
        <a
          href="tel:+15818892093"
          className="shrink-0 rounded-md border border-cta bg-cta px-4 py-2.5 text-[13px] font-medium text-white hover:bg-cta-hover"
        >
          Appelez-nous → 581 889-2093
        </a>
      </section>
    </MarketingLayout>
  );
}
