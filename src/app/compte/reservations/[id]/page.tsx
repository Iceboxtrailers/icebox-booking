import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { Card } from "@/components/ui/Card";
import { fmt, nights } from "@/lib/dates";
import { priceBreakdown } from "@/lib/pricing";
import type { TrailerSize } from "@/lib/constants";

const STATUS_LABEL_FR: Record<string, string> = {
  pending: "En cours de réservation",
  confirmed: "Confirmée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

const DEPOSIT_LABEL_FR: Record<string, string> = {
  none: "Aucun dépôt requis",
  authorized: "Dépôt autorisé",
  captured: "Dépôt prélevé",
  released: "Dépôt remis",
};

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = await getCurrentClientId();
  if (!clientId) notFound();

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { client: true, trailer: true, contract: true, payments: true },
  });
  if (!reservation || reservation.clientId !== clientId) notFound();

  const start = reservation.pickupDate?.toISOString().slice(0, 10) ?? null;
  const end = reservation.returnDate?.toISOString().slice(0, 10) ?? null;
  const size = reservation.trailer?.size as TrailerSize | undefined;
  const breakdown = size && start && end ? priceBreakdown(size, start, end) : null;

  return (
    <div>
      <Link href="/compte/reservations" className="mb-4 inline-block text-[13px] text-navy hover:underline">
        ← Retour à mes réservations
      </Link>

      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="font-heading text-lg">
              Remorque {reservation.trailer?.size ?? "—"}
            </div>
            <div className="text-[13px] text-muted">
              {start ? fmt(start) : "—"} → {end ? fmt(end) : "—"}
              {start && end ? ` (${nights(start, end)} nuit${nights(start, end) > 1 ? "s" : ""})` : ""}
            </div>
          </div>
          <span className="rounded-full bg-[#E4EEF4] px-3 py-1 text-[12px] font-medium text-navy">
            {STATUS_LABEL_FR[reservation.status] ?? reservation.status}
          </span>
        </div>

        <div className="mb-5 border-t border-border-light pt-4">
          <div className="mb-2 text-[13px] font-medium">Facture</div>
          {breakdown ? (
            <div className="space-y-1 text-[13px]">
              {breakdown.months > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{breakdown.months} mois</span>
                </div>
              )}
              {breakdown.weeks > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{breakdown.weeks} semaine(s)</span>
                </div>
              )}
              {breakdown.days > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{breakdown.days} jour(s)</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-border-light pt-2 font-medium">
                <span>Total (avant taxes)</span>
                <span className="font-mono">{(reservation.totalAmount / 100).toFixed(2)} $</span>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-muted">
              Total : <span className="font-mono">{(reservation.totalAmount / 100).toFixed(2)} $</span> (avant
              taxes)
            </div>
          )}
        </div>

        <div className="mb-5 border-t border-border-light pt-4">
          <div className="mb-2 text-[13px] font-medium">Dépôt de sécurité</div>
          <div className="text-[13px] text-muted">
            {DEPOSIT_LABEL_FR[reservation.depositStatus] ?? reservation.depositStatus}
            {reservation.depositAmount > 0 && (
              <span className="font-mono"> — {(reservation.depositAmount / 100).toFixed(2)} $</span>
            )}
          </div>
        </div>

        <div className="border-t border-border-light pt-4">
          <div className="mb-2 text-[13px] font-medium">Contrat</div>
          {reservation.contract?.signatureStatus === "signed" && reservation.contract.pdfUrl ? (
            <a
              href={reservation.contract.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-navy hover:underline"
            >
              Voir le contrat signé
            </a>
          ) : (
            <div className="text-[13px] text-muted">Aucun contrat signé pour cette réservation.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
