import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { fmt } from "@/lib/dates";
import type { FunnelReport } from "@/lib/admin/funnel";

export const FUNNEL_PERIODS = [7, 30, 90] as const;

const percent = new Intl.NumberFormat("fr-CA", { style: "percent", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });
const money = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" });

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </Card>
  );
}

export function FunnelReportView({ report }: { report: FunnelReport }) {
  const { started, steps, abandoned } = report;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted">Période :</span>
        {FUNNEL_PERIODS.map((days) => (
          <Link
            key={days}
            href={`/dashboard/abandons?jours=${days}`}
            aria-current={days === report.days ? "true" : undefined}
            className={`rounded-md px-3 py-1.5 font-medium ${
              days === report.days ? "bg-tint text-navy" : "text-muted hover:bg-hover hover:text-foreground"
            }`}
          >
            {days} jours
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Réservations commencées" value={String(started)} sub="coordonnées saisies" />
        <StatCard label="Confirmées" value={String(report.confirmed)} />
        <StatCard
          label="Taux de réservation"
          value={report.conversionRate === null ? "—" : percent.format(report.conversionRate)}
          sub="confirmées sur commencées"
        />
        <StatCard label="En cours" value={String(report.inProgress)} sub="commencées il y a moins de 2 h" />
      </div>

      <Card className="mb-6 p-5">
        <div className="mb-4 text-[13px] font-semibold">Où les clients s&apos;arrêtent</div>
        {started === 0 ? (
          <div className="text-[13px] text-muted">Aucune réservation commencée pendant cette période.</div>
        ) : (
          <ol className="space-y-3">
            {steps.map((step, index) => {
              const lost = index > 0 ? steps[index - 1].count - step.count : 0;
              return (
                <li key={step.label}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                    <span>{step.label}</span>
                    <span className="tabular-nums text-muted">
                      <strong className="font-semibold text-foreground">{step.count}</strong> · {percent.format(step.count / started)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-border-light">
                    <div className="h-2 rounded-full bg-navy" style={{ width: `${(step.count / started) * 100}%` }} />
                  </div>
                  {lost > 0 && (
                    <div className="mt-0.5 text-[11px] text-muted">
                      {lost} {lost > 1 ? "personnes se sont arrêtées" : "personne s'est arrêtée"} avant cette étape
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <div className="mb-2 text-[13px] font-semibold">Réservations abandonnées</div>
      <p className="mb-3 text-[12px] text-muted">
        Réservations restées « en attente » depuis plus de 2 heures. Ces coordonnées sont confidentielles : n&apos;appelez
        que pour aider quelqu&apos;un à terminer sa réservation.
      </p>
      {abandoned.length === 0 ? (
        <Card className="p-5 text-[13px] text-muted">Aucun abandon pendant cette période.</Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-light bg-white">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="bg-subtle text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Commencée le</th>
                <th className="px-3 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 font-medium">Dernière étape</th>
                <th className="px-3 py-2.5 font-medium">Dates</th>
                <th className="px-3 py-2.5 font-medium">Remorque</th>
                <th className="px-3 py-2.5 text-right font-medium">Montant</th>
              </tr>
            </thead>
            <tbody>
              {abandoned.map((booking) => (
                <tr key={booking.id} className="border-t border-border-light align-top">
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted">{dateTime.format(booking.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{booking.name}</div>
                    <div className="text-[12px] text-muted">
                      <a href={`mailto:${booking.email}`} className="hover:text-navy">
                        {booking.email}
                      </a>
                      {" · "}
                      <a href={`tel:${booking.phone}`} className="hover:text-navy">
                        {booking.phone}
                      </a>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{booking.stepLabel}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {booking.pickupDate && booking.returnDate ? `${fmt(booking.pickupDate)} → ${fmt(booking.returnDate)}` : "—"}
                  </td>
                  <td className="px-3 py-2.5">{booking.trailerSize ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {booking.totalCents > 0 ? money.format(booking.totalCents / 100) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-[12px] text-muted">
        Ce rapport compte les clients à partir du moment où ils saisissent leurs coordonnées. Les visites de
        l&apos;accueil et les dates cherchées sans aller plus loin ne sont pas encore mesurées. Les réservations
        marquées « test » dans la console sont exclues; celles que vous saisissez vous-même aussi.
      </p>
    </div>
  );
}
