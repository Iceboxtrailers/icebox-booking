"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { MonthCalendar } from "@/lib/admin/calendar";
import { ReservationModal } from "@/components/admin/ReservationModal";

const MONTH_LABELS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

type ModalState =
  | { mode: "edit"; reservationId: string }
  | { mode: "create"; trailerId: string; pickupDate: string }
  | null;

function isoDateForDay(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function FleetCalendar({ calendar }: { calendar: MonthCalendar }) {
  const { year, month, daysInMonth, rows } = calendar;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const [modal, setModal] = useState<ModalState>(null);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const trailers = rows.map((r) => ({ id: r.trailerId, name: r.trailerName, size: r.size }));

  function openBlankCreate() {
    const today = new Date().toISOString().slice(0, 10);
    setModal({ mode: "create", trailerId: trailers[0]?.id ?? "", pickupDate: today });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="font-heading text-lg">
          {MONTH_LABELS_FR[month - 1]} {year}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="cta" onClick={openBlankCreate}>
            <Plus size={14} /> Réservation
          </Button>
          <Link
            href={`/dashboard?year=${prevYear}&month=${prevMonth}`}
            className="rounded-md border border-border px-3 py-1.5 text-[13px] hover:bg-[#EDF2F4]"
          >
            ← Précédent
          </Link>
          <Link
            href={`/dashboard?year=${nextYear}&month=${nextMonth}`}
            className="rounded-md border border-border px-3 py-1.5 text-[13px] hover:bg-[#EDF2F4]"
          >
            Suivant →
          </Link>
        </div>
      </div>

      <div className="mb-2 text-[11px] text-muted">
        Cliquez sur une réservation pour la modifier, ou sur une case vide pour en créer une nouvelle.
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-light">
        <table className="border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[#FAFBFB] px-2 py-1.5 text-left font-medium text-muted">
                Remorque
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  className="min-w-[26px] border-l border-border-light bg-[#FAFBFB] px-1 py-1.5 text-center font-medium text-muted"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cells = [];
              let day = 1;
              while (day <= daysInMonth) {
                const block = row.blocks.find((b) => b.startDay === day);
                if (block) {
                  const span = block.endDay - block.startDay + 1;
                  cells.push(
                    <td
                      key={day}
                      colSpan={span}
                      title={block.label}
                      onClick={() => setModal({ mode: "edit", reservationId: block.reservationId })}
                      className="cursor-pointer whitespace-nowrap border-l border-border-light bg-[#E4EEF4] px-1 py-1.5 text-center font-medium text-navy hover:bg-[#cfe2ee]"
                    >
                      {span >= 2 ? block.label : ""}
                    </td>
                  );
                  day += span;
                } else {
                  const thisDay = day;
                  cells.push(
                    <td
                      key={day}
                      onClick={() =>
                        setModal({
                          mode: "create",
                          trailerId: row.trailerId,
                          pickupDate: isoDateForDay(year, month, thisDay),
                        })
                      }
                      className="cursor-pointer border-l border-border-light px-1 py-1.5 hover:bg-[#F4F6F7]"
                    />
                  );
                  day += 1;
                }
              }
              return (
                <tr key={row.trailerId}>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5 font-medium">
                    {row.trailerName}
                  </td>
                  {cells}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <ReservationModal
          key={modal.mode === "edit" ? modal.reservationId : `create-${modal.trailerId}-${modal.pickupDate}`}
          state={modal}
          trailers={trailers}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
