import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { WizardShell } from "@/components/wizard/WizardShell";
import { ConfirmationSummary } from "@/components/forms/ConfirmationSummary";
import { stepIndexForSegment } from "@/lib/wizard";
import { confirmReservation, ReservationConfirmError } from "@/lib/reservations/confirm";

export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const clientId = session?.clientId;
  if (!clientId) redirect(`/login?callbackUrl=/reservation/${id}/confirmation`);

  let reservation;
  try {
    reservation = await confirmReservation(id, clientId);
  } catch (err) {
    if (err instanceof ReservationConfirmError) {
      if (err.message === "Introuvable") notFound();
      return (
        <WizardShell step={stepIndexForSegment("confirmation")}>
          <div className="text-[13px] text-red-600">{err.message}</div>
        </WizardShell>
      );
    }
    throw err;
  }

  if (!reservation.trailer || !reservation.pickupDate || !reservation.returnDate) notFound();

  return (
    <WizardShell step={stepIndexForSegment("confirmation")}>
      <ConfirmationSummary
        firstName={reservation.client.firstName}
        lastName={reservation.client.lastName}
        trailerSize={reservation.trailer.size}
        start={reservation.pickupDate.toISOString().slice(0, 10)}
        end={reservation.returnDate.toISOString().slice(0, 10)}
        guest={Boolean(session?.guest)}
      />
    </WizardShell>
  );
}
