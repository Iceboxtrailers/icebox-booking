import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { WizardShell } from "@/components/wizard/WizardShell";
import { AvailabilityList } from "@/components/forms/AvailabilityList";
import { stepIndexForSegment } from "@/lib/wizard";
import { searchAvailability } from "@/lib/availability";
import { TRAILER_SIZE, TRAILER_TYPE } from "@/lib/constants";
import type { DateRangeType, TrailerSize, TrailerType } from "@/lib/constants";

export default async function DisponibilitesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; size?: string }>;
}) {
  const { id } = await params;
  const { type, size } = await searchParams;
  const clientId = await getCurrentClientId();
  if (!clientId) redirect(`/login?callbackUrl=/reservation/${id}/disponibilites`);

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation || reservation.clientId !== clientId) notFound();
  if (reservation.status !== "pending") redirect(`/reservation/${id}/confirmation`);

  const validType = TRAILER_TYPE.includes(type as TrailerType) ? (type as TrailerType) : null;
  const validSize = TRAILER_SIZE.includes(size as TrailerSize) ? (size as TrailerSize) : null;
  if (!validType || !validSize || !reservation.pickupDate || !reservation.returnDate) {
    redirect(`/reservation/${id}/remorque-dates`);
  }

  const candidates = await searchAvailability({
    type: validType,
    size: validSize,
    dateRangeType: reservation.dateRangeType as DateRangeType,
    start: reservation.pickupDate.toISOString().slice(0, 10),
    end: reservation.returnDate.toISOString().slice(0, 10),
    flexWindowDays: reservation.flexWindowDays,
    excludeReservationId: reservation.id,
  });

  return (
    <WizardShell step={stepIndexForSegment("disponibilites")}>
      <AvailabilityList reservationId={id} candidates={candidates} />
    </WizardShell>
  );
}
