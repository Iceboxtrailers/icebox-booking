import { FunnelReportView, FUNNEL_PERIODS } from "@/components/admin/FunnelReportView";
import { requireOwnerPage } from "@/lib/admin-auth";
import { getBookingFunnel } from "@/lib/admin/funnel";

export const metadata = { title: "Abandons et conversion — Console IceBox" };

export default async function AbandonsPage({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  await requireOwnerPage();
  const { jours } = await searchParams;
  const requested = Number(jours);
  const days = FUNNEL_PERIODS.find((period) => period === requested) ?? 30;
  const report = await getBookingFunnel(days);

  return (
    <div>
      <h1 className="font-heading mb-2 text-2xl">Abandons</h1>
      <p className="mb-5 max-w-2xl text-[13px] text-muted">
        Combien de clients commencent une réservation, où ils s&apos;arrêtent, et quel pourcentage la termine.
      </p>
      <FunnelReportView report={report} />
    </div>
  );
}
