import { redirect } from "next/navigation";
import { getCurrentClientId } from "@/lib/session";
import { startOrResumeReservation } from "@/lib/reservations/start";
import { MarketingLayout } from "@/components/MarketingLayout";

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

  const reservation = await startOrResumeReservation(
    clientId,
    hasValidDates
      ? { pickupDate: new Date(`${pickupDate}T00:00:00Z`), returnDate: new Date(`${returnDate}T00:00:00Z`) }
      : {},
  );
  if (!reservation) {
    return (
      <MarketingLayout>
        <h1 className="font-heading mb-2 text-2xl">Trop de réservations commencées</h1>
        <p className="max-w-xl text-[14px] text-muted">
          Vous avez commencé plusieurs réservations aujourd&apos;hui. Réessayez demain ou appelez-nous au{" "}
          <a href="tel:+15818892093" className="text-navy underline">
            581 889-2093
          </a>
          .
        </p>
      </MarketingLayout>
    );
  }
  redirect(`/reservation/${reservation.id}/remorque-dates`);
}
