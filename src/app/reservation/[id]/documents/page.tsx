import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { WizardShell } from "@/components/wizard/WizardShell";
import { DocumentUpload } from "@/components/forms/DocumentUpload";
import { stepIndexForSegment } from "@/lib/wizard";

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = await getCurrentClientId();
  if (!clientId) redirect(`/login?callbackUrl=/reservation/${id}/documents`);

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation || reservation.clientId !== clientId) notFound();
  if (reservation.status !== "pending") redirect(`/reservation/${id}/confirmation`);
  if (!reservation.trailerId) redirect(`/reservation/${id}/remorque-dates`);

  return (
    <WizardShell step={stepIndexForSegment("documents")}>
      <DocumentUpload reservationId={id} />
    </WizardShell>
  );
}
