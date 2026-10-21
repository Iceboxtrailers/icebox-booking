"use client";

import { useState } from "react";

type Point = { day: string; visits: number };

const PLOT_HEIGHT = 160;
// A column is a touch target, so it never gets narrower than 24px (WCAG 2.2): on a phone the plot
// scrolls sideways instead of squeezing thirty bars into 7px each.
const COLUMN_MIN_WIDTH = 24;
const COLUMN_GAP = 2;
const shortDay = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const atNoon = (day: string) => new Date(`${day}T12:00:00Z`);

const visitsLabel = (count: number) => `${count} visite${count > 1 ? "s" : ""}`;

// Clean axis steps (1, 2, 5, 10, 20, 50...) so the ticks read as round numbers.
function niceStep(max: number): number {
  if (max <= 4) return 1;
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / magnitude;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
}

// One series, so no legend: the title says what is plotted. Each column is the hover/focus target
// (taller and wider than the thin bar), its value is read out above the plot (a floating tooltip would
// be clipped by the sideways scroll on a phone), and the same numbers are in the table underneath.
export function DailyVisitsChart({ data }: { data: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((point) => point.visits));
  const step = niceStep(max);
  const axisMax = Math.max(step * Math.ceil(max / step), step);
  const ticks = Array.from({ length: axisMax / step + 1 }, (_, index) => index * step);
  const labelEvery = data.length <= 10 ? 1 : data.length <= 35 ? 5 : 15;

  return (
    <div>
      <div role="status" className="mb-2 min-h-5 text-[12px]">
        {active !== null ? (
          <>
            <span className="text-[13px] font-semibold">{visitsLabel(data[active].visits)}</span>
            <span className="text-muted"> · {longDay.format(atNoon(data[active].day))}</span>
          </>
        ) : (
          <span className="text-muted">Survolez ou touchez une barre pour voir le détail.</span>
        )}
      </div>

      <div className="flex">
        <div className="relative mr-2 w-8 shrink-0" style={{ height: PLOT_HEIGHT }} aria-hidden>
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute right-0 translate-y-1/2 text-[11px] tabular-nums text-muted"
              style={{ bottom: `${(tick / axisMax) * 100}%` }}
            >
              {tick}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto pb-2">
          <div style={{ minWidth: data.length * (COLUMN_MIN_WIDTH + COLUMN_GAP) - COLUMN_GAP }}>
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {ticks.map((tick) => (
                <div key={tick} className="absolute inset-x-0 border-t border-border-light" style={{ bottom: `${(tick / axisMax) * 100}%` }} aria-hidden />
              ))}

              <div className="absolute inset-0 flex" style={{ gap: COLUMN_GAP }} onMouseLeave={() => setActive(null)}>
                {data.map((point, index) => (
                  <button
                    key={point.day}
                    type="button"
                    aria-label={`${longDay.format(atNoon(point.day))} : ${visitsLabel(point.visits)}`}
                    onMouseEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    className="group flex flex-1 items-end justify-center outline-none"
                    style={{ minWidth: COLUMN_MIN_WIDTH }}
                  >
                    <span
                      className="block w-full max-w-[24px] rounded-t-[4px] bg-navy group-hover:bg-accent group-focus-visible:bg-accent"
                      style={{ height: `${(point.visits / axisMax) * 100}%`, minHeight: point.visits > 0 ? 2 : 0 }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-1.5 flex text-[11px] text-muted" style={{ gap: COLUMN_GAP }} aria-hidden>
              {data.map((point, index) => (
                <div key={point.day} className="relative flex-1" style={{ minWidth: COLUMN_MIN_WIDTH }}>
                  {index % labelEvery === 0 && (
                    // The first label starts at the column's edge: centred, half of it would fall outside the scroll area.
                    <span className={`absolute whitespace-nowrap ${index === 0 ? "left-0" : "left-1/2 -translate-x-1/2"}`}>
                      {shortDay.format(atNoon(point.day))}
                    </span>
                  )}
                  <span className="invisible">.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <details className="mt-4 text-[12px]">
        <summary className="cursor-pointer font-medium text-navy hover:underline">Voir les données en tableau</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-border-light">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-subtle text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Jour</th>
                <th className="px-3 py-2 text-right font-medium">Visites</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((point) => (
                <tr key={point.day} className="border-t border-border-light">
                  <td className="px-3 py-1.5 capitalize">{longDay.format(atNoon(point.day))}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{point.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
