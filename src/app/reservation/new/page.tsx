import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";

export default async function NewReservationPage() {
  const clientId = await getCurrentClientId();
  if (!clientId) {
    redirect("/login?callbackUrl=/reservation/new");
  }

  const reservation = await prisma.reservation.create({ data: { clientId } });
  redirect(`/reservation/${reservation.id}/remorque-dates`);
}
