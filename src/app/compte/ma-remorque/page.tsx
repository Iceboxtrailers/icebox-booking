import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { Card } from "@/components/ui/Card";
import { fmt } from "@/lib/dates";
import { Thermometer, Zap, DoorClosed, History, Clock } from "lucide-react";

const TELEMETRY_FIELDS = [
  { icon: Thermometer, label: "Température actuelle" },
  { icon: Zap, label: "État alimentation" },
  { icon: DoorClosed, label: "Statut porte" },
  { icon: History, label: "Historique de température" },
  { icon: Clock, label: "Heure de retour" },
];

export default async function MaRemorquePage() {
  const clientId = await getCurrentClientId();
  const reservation = await prisma.reservation.findFirst({
    where: { clientId: clientId!, status: { in: ["confirmed", "in_progress"] } },
    include: { trailer: true },
    orderBy: { pickupDate: "asc" },
  });

  return (
    <div>
      <Card className="mb-6 p-4">
        {reservation ? (
          <div className="text-[13px]">
            <div className="font-medium">Remorque {reservation.trailer?.size ?? "—"}</div>
            <div className="text-muted">
              {reservation.pickupDate ? fmt(reservation.pickupDate.toISOString().slice(0, 10)) : "—"} →{" "}
              {reservation.returnDate ? fmt(reservation.returnDate.toISOString().slice(0, 10)) : "—"}
            </div>
            {reservation.trailer?.plate && (
              <div className="mt-1 text-muted">
                Immatriculation : <span className="font-mono">{reservation.trailer.plate}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[13px] text-muted">Aucune location active pour l&apos;instant.</div>
        )}
      </Card>

      <div className="mb-3 text-[13px] font-medium">Suivi de la remorque (IceBox BOX)</div>
      <p className="mb-4 text-[12px] text-muted">
        À venir : avec le boîtier IceBox BOX, vous pourrez suivre votre remorque en temps réel directement
        depuis cet espace.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TELEMETRY_FIELDS.map(({ icon: Icon, label }) => (
          <Card key={label} className="flex items-center justify-between p-3.5 text-[13px]">
            <span className="flex items-center gap-2 text-foreground">
              <Icon size={15} className="text-muted" /> {label}
            </span>
            <span className="rounded-full bg-[#F4F6F7] px-2.5 py-1 text-[11px] text-muted">À venir</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
