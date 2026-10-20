import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { WizardShell } from "@/components/wizard/WizardShell";
import { ConfirmationSummary } from "@/components/forms/ConfirmationSummary";
import { buttonClassName } from "@/components/ui/Button";
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
      if (err.code === "slot_taken") {
        // Someone else finished first: nothing was charged, and the client can pick again right away.
        return (
          <WizardShell step={stepIndexForSegment("confirmation")}>
            <div className="rounded-lg border border-warn-line bg-warn-soft p-4 text-[13px]">
              <div className="mb-1 text-[14px] font-medium">{err.message}</div>
              <p className="mb-3 text-muted">
                La remorque est accordée à la première personne qui termine sa réservation, et quelqu&apos;un a terminé juste
                avant vous. Vous n&apos;avez rien payé : votre carte n&apos;a pas été débitée. Choisissez une autre remorque ou
                d&apos;autres dates; votre carte reste enregistrée et le contrat sera à signer de nouveau.
              </p>
              <Link href={`/reservation/${id}/disponibilites`} className={buttonClassName("cta")}>
                Voir les disponibilités
              </Link>
            </div>
          </WizardShell>
        );
      }
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
