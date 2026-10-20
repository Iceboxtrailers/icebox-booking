import { FUNNEL_PERIODS } from "@/components/admin/FunnelReportView";
import { TrafficReportView } from "@/components/admin/TrafficReportView";
import { requireOwnerPage } from "@/lib/admin-auth";
import { getTrafficReport } from "@/lib/admin/traffic";

export const metadata = { title: "Trafic — Console IceBox" };

export default async function TrafficPage({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  await requireOwnerPage();
  const { jours } = await searchParams;
  const requested = Number(jours);
  const days = FUNNEL_PERIODS.find((period) => period === requested) ?? 30;
  const report = await getTrafficReport(days);

  return (
    <div>
      <h1 className="font-heading mb-2 text-2xl">Trafic</h1>
      <p className="mb-5 max-w-2xl text-[13px] text-muted">
        Combien de personnes visitent le site, d&apos;où elles viennent, et quel pourcentage finit par réserver.
      </p>
      <TrafficReportView report={report} />
    </div>
  );
}
