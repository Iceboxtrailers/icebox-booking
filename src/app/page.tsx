import { MarketingLayout } from "@/components/MarketingLayout";
import { Hero } from "@/components/Hero";
import { Card } from "@/components/ui/Card";
import { CATALOGUE } from "@/lib/catalogue";
import {
  RATE_TABLE,
  TRANSPORT_FEE_PER_TRIP_CENTS,
  TRANSPORT_FEE_PER_KM_BEYOND_CENTS,
  URGENCY_FEE_PER_KM_CENTS,
  URGENCY_FEE_PER_HOUR_CENTS,
  URGENCY_MIN_HOURS,
} from "@/lib/pricing";

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function HomePage() {
  return (
    <MarketingLayout>
      <Hero />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CATALOGUE.map((item) => (
          <Card key={item.size} className="p-4">
            <div className="mb-1 text-sm font-medium">
              Remorque {item.size} <span className="text-xs font-normal text-muted">({item.tempRangeLabel})</span>
            </div>
            <div className="mb-2 text-xs text-muted">{item.description}</div>
            <div className="font-mono text-sm font-medium">à partir de {money(RATE_TABLE[item.size].dayCents)} $/jour</div>
          </Card>
        ))}
      </div>

      <section id="tarification" className="mt-12 scroll-mt-6">
        <h2 className="font-heading mb-4 text-xl">Tarification</h2>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card className="p-4 text-[13px]">
            <div className="mb-1 font-medium">Transport (livraison et récupération)</div>
            <div className="text-muted">
              {money(TRANSPORT_FEE_PER_TRIP_CENTS)} $ / aller, 50 km maximum inclus — {money(TRANSPORT_FEE_PER_KM_BEYOND_CENTS)} $ / km supplémentaire.
            </div>
          </Card>
          <Card className="p-4 text-[13px]">
            <div className="mb-1 font-medium">Urgence (livraison de dernière minute)</div>
            <div className="text-muted">
              {money(URGENCY_FEE_PER_KM_CENTS)} $ / km en supplément de la location, {money(URGENCY_FEE_PER_HOUR_CENTS)} $ / heure ({URGENCY_MIN_HOURS} heures minimum).
            </div>
          </Card>
        </div>

        <p className="mt-4 text-[11px] text-muted">
          Prix avant taxes. Un dépôt de sécurité est requis à la réservation. Le client est responsable du
          chargement et du déchargement; un nettoyage est requis au retour. Des frais supplémentaires peuvent
          s&apos;appliquer en cas de dommages ou de retards.
        </p>
      </section>
    </MarketingLayout>
  );
}
