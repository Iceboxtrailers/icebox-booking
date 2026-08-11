import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { WizardShell } from "@/components/wizard/WizardShell";
import { TrailerDateForm } from "@/components/forms/TrailerDateForm";
import { stepIndexForSegment } from "@/lib/wizard";
import type { DateRangeType } from "@/lib/constants";

export default async function RemorqueDatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = await getCurrentClientId();
  if (!clientId) redirect(`/login?callbackUrl=/reservation/${id}/remorque-dates`);

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation || reservation.clientId !== clientId) notFound();
  if (reservation.status !== "pending") redirect(`/reservation/${id}/confirmation`);

  const initial = {
    dateRangeType: (reservation.dateRangeType as DateRangeType) ?? "fixed",
    start: reservation.pickupDate ? reservation.pickupDate.toISOString().slice(0, 10) : "",
    end: reservation.returnDate ? reservation.returnDate.toISOString().slice(0, 10) : "",
    usageLocation: reservation.usageLocation ?? "",
  };

  return (
    <WizardShell step={stepIndexForSegment("remorque-dates")}>
      <TrailerDateForm reservationId={id} initial={initial} />
    </WizardShell>
  );
}
