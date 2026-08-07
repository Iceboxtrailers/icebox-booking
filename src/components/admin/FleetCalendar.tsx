import Link from "next/link";
import type { MonthCalendar } from "@/lib/admin/calendar";

const MONTH_LABELS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function FleetCalendar({ calendar }: { calendar: MonthCalendar }) {
  const { year, month, daysInMonth, rows } = calendar;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="font-heading text-lg">
          {MONTH_LABELS_FR[month - 1]} {year}
        </div>
        <div className="flex gap-2">
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
                      className="whitespace-nowrap border-l border-border-light bg-[#E4EEF4] px-1 py-1.5 text-center font-medium text-navy"
                    >
                      {span >= 2 ? block.label : ""}
                    </td>
                  );
                  day += span;
                } else {
                  cells.push(<td key={day} className="border-l border-border-light px-1 py-1.5" />);
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
    </div>
  );
}
