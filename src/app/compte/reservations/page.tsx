import { getCurrentClientId } from "@/lib/session";
import { getRentalHistory } from "@/lib/queries/rental-history";
import { Card } from "@/components/ui/Card";
import { fmt } from "@/lib/dates";

const STATUS_LABEL_FR: Record<string, string> = {
  pending: "En cours de réservation",
  confirmed: "Confirmée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

function daysUntilLabel(pickupDate: Date): string {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.ceil((pickupDate.getTime() - startOfToday.getTime()) / 86400000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} jours`;
}

export default async function ReservationsPage() {
  const clientId = await getCurrentClientId();
  const reservations = await getRentalHistory(clientId!);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = reservations.filter(
    (r) => ["confirmed", "in_progress"].includes(r.status) && r.pickupDate && r.pickupDate >= today
  );
  const past = reservations.filter((r) => !upcoming.includes(r));

  return (
    <div>
      <div className="mb-3 text-[13px] font-medium">À venir</div>
      {upcoming.length === 0 && <div className="mb-6 text-[13px] text-muted">Aucune réservation à venir.</div>}
      {upcoming.map((r) => (
        <Card key={r.id} className="mb-3 p-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-sm font-medium">
              Remorque {r.trailer?.size ?? "—"} — {STATUS_LABEL_FR[r.status] ?? r.status}
            </div>
            <div className="rounded-full bg-[#E4EEF4] px-2.5 py-1 text-[11px] font-medium text-navy">
              {r.pickupDate ? daysUntilLabel(r.pickupDate) : ""}
            </div>
          </div>
          <div className="text-xs text-muted">
            {r.pickupDate ? fmt(r.pickupDate.toISOString().slice(0, 10)) : "—"} →{" "}
            {r.returnDate ? fmt(r.returnDate.toISOString().slice(0, 10)) : "—"}
          </div>
          <div className="font-mono mt-1 text-xs">{(r.totalAmount / 100).toFixed(2)} $</div>
        </Card>
      ))}

      <div className="mt-8 mb-3 text-[13px] font-medium">Historique</div>
      {past.length === 0 && <div className="text-[13px] text-muted">Aucune réservation passée.</div>}
      {past.map((r) => (
        <Card key={r.id} className="mb-3 p-4">
          <div className="mb-1 text-sm font-medium">
            Remorque {r.trailer?.size ?? "—"} — {STATUS_LABEL_FR[r.status] ?? r.status}
          </div>
          <div className="text-xs text-muted">
            {r.pickupDate ? fmt(r.pickupDate.toISOString().slice(0, 10)) : "—"} →{" "}
            {r.returnDate ? fmt(r.returnDate.toISOString().slice(0, 10)) : "—"}
          </div>
          <div className="font-mono mt-1 text-xs">{(r.totalAmount / 100).toFixed(2)} $</div>
        </Card>
      ))}
    </div>
  );
}
