import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ pickupDate?: string; returnDate?: string }>;
}) {
  const { pickupDate, returnDate } = await searchParams;
  const clientId = await getCurrentClientId();
  if (!clientId) {
    const qs = new URLSearchParams();
    if (pickupDate) qs.set("pickupDate", pickupDate);
    if (returnDate) qs.set("returnDate", returnDate);
    const suffix = qs.toString() ? `?${qs}` : "";
    redirect(`/login?callbackUrl=${encodeURIComponent(`/reservation/new${suffix}`)}`);
  }

  // Pre-fills the next step from the homepage's date search — still fully
  // editable there, just saves re-typing what the customer already gave us.
  const hasValidDates =
    pickupDate && returnDate && ISO_DATE.test(pickupDate) && ISO_DATE.test(returnDate) && returnDate > pickupDate;

  const reservation = await prisma.reservation.create({
    data: hasValidDates
      ? {
          clientId,
          pickupDate: new Date(`${pickupDate}T00:00:00Z`),
          returnDate: new Date(`${returnDate}T00:00:00Z`),
        }
      : { clientId },
  });
  redirect(`/reservation/${reservation.id}/remorque-dates`);
}
