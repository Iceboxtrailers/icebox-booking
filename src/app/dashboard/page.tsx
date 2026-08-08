import { Card } from "@/components/ui/Card";
import { getDashboardKpis } from "@/lib/admin/kpis";
import { getFleetBoardData } from "@/lib/admin/board";
import { FleetBoard } from "@/components/admin/FleetBoard";
import { TRAILER_SIZE } from "@/lib/constants";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-heading text-2xl">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year: yearParam, month: monthParam } = await searchParams;
  const now = new Date();
  const year = Number(yearParam) || now.getFullYear();
  const month = Number(monthParam) || now.getMonth() + 1;

  const [kpis, board] = await Promise.all([getDashboardKpis(), getFleetBoardData(year, month)]);

  const mostRequested = kpis.bookingsBySize[0];
  const mostRequestedLabel = mostRequested ? `${mostRequested.size} (${mostRequested.count})` : "—";

  return (
    <div>
      <h1 className="font-heading mb-6 text-2xl">Tableau de bord</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Réservations (total)" value={String(kpis.totalReservations)} />
        <StatCard label="Ce mois-ci" value={String(kpis.reservationsThisMonth)} />
        <StatCard label="À venir" value={String(kpis.upcomingCount)} />
        <StatCard
          label="Revenu total"
          value={`${(kpis.totalRevenueCents / 100).toFixed(2)} $`}
          sub="avant taxes"
        />
        <StatCard
          label="Durée moyenne"
          value={kpis.avgNights !== null ? `${kpis.avgNights.toFixed(1)} j` : "—"}
        />
        <StatCard label="Remorque la + demandée" value={mostRequestedLabel} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:w-1/2">
        {TRAILER_SIZE.map((size) => {
          const entry = kpis.bookingsBySize.find((b) => b.size === size);
          return (
            <Card key={size} className="p-3 text-[13px]">
              <span className="font-medium">{size}</span>{" "}
              <span className="text-muted">{entry?.count ?? 0} réservation(s)</span>
            </Card>
          );
        })}
      </div>

      <div className="mt-8">
        <FleetBoard board={board} />
      </div>
    </div>
  );
}
