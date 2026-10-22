import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { DailyVisitsChart } from "@/components/admin/DailyVisitsChart";
import { FUNNEL_PERIODS } from "@/components/admin/FunnelReportView";
import type { TrafficCount, TrafficReport } from "@/lib/admin/traffic";

const percent = new Intl.NumberFormat("fr-CA", { style: "percent", maximumFractionDigits: 0 });
const percentOne = new Intl.NumberFormat("fr-CA", { style: "percent", maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeZone: "America/Toronto" });

const PAGE_LABEL: Record<string, string> = {
  "/": "Accueil",
  "/faq": "Questions fréquentes",
  "/contact": "Contact",
  "/comment-ca-marche": "Comment ça marche",
  "/chambre-froide": "Chambres froides",
  "/chambre-congelation": "Chambres de congélation",
  "/attaches-accessoires": "Attaches et accessoires",
  "/devenir-concessionnaire": "Devenir concessionnaire",
  "/conditions": "Conditions d'utilisation",
  "/confidentialite": "Politique de confidentialité",
  "/login": "Connexion",
  "/signup": "Création de compte",
  "/mot-de-passe-oublie": "Mot de passe oublié",
  "/reservation/invite": "Réservation : début",
  "/reservation/new": "Réservation : nouvelle",
  "/reservation/:id/remorque-dates": "Réservation : remorque et dates",
  "/reservation/:id/disponibilites": "Réservation : disponibilités",
  "/reservation/:id/documents": "Réservation : documents",
  "/reservation/:id/contrat": "Réservation : contrat",
  "/reservation/:id/depot": "Réservation : dépôt",
  "/reservation/:id/confirmation": "Réservation : confirmation",
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </Card>
  );
}

// A ranked list: label, count and a thin bar sized against the largest row.
function BarList({ title, rows, empty }: { title: string; rows: { label: string; value: number; note?: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <Card className="p-5">
      <div className="mb-3 text-[13px] font-semibold">{title}</div>
      {rows.length === 0 ? (
        <div className="text-[13px] text-muted">{empty}</div>
      ) : (
        <ol className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  <strong className="font-semibold text-foreground">{row.value}</strong>
                  {row.note ? ` · ${row.note}` : ""}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-border-light">
                <div className="h-1.5 rounded-full bg-navy" style={{ width: `${(row.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

const asRows = (counts: TrafficCount[], total: number) =>
  counts.map((row) => ({ label: row.label, value: row.visits, note: total > 0 ? percent.format(row.visits / total) : undefined }));

export function TrafficReportView({ report }: { report: TrafficReport }) {
  const { visits } = report;
  const funnel = [
    { label: "Visites", count: visits },
    { label: "Ont cherché des dates", count: report.searched },
    { label: "Ont ouvert la réservation", count: report.opened },
    { label: "Ont saisi leurs coordonnées", count: report.booking.steps[0]?.count ?? 0 },
    { label: "Réservations confirmées", count: report.booking.confirmed },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted">Période :</span>
        {FUNNEL_PERIODS.map((days) => (
          <Link
            key={days}
            href={`/dashboard/trafic?jours=${days}`}
            aria-current={days === report.days ? "true" : undefined}
            className={`rounded-md px-3 py-1.5 font-medium ${
              days === report.days ? "bg-tint text-navy" : "text-muted hover:bg-hover hover:text-foreground"
            }`}
          >
            {days} jours
          </Link>
        ))}
      </div>

      {report.trackingSince === null ? (
        <Card className="mb-6 border-warn-line bg-warn-soft p-4 text-[13px]">
          Le suivi est actif, mais aucune visite n&apos;a encore été enregistrée. Les premiers chiffres apparaîtront ici dès que
          des visiteurs consulteront le site.
        </Card>
      ) : (
        <p className="mb-5 text-[12px] text-muted">Suivi actif depuis le {date.format(report.trackingSince)}.</p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Visites" value={String(visits)} sub="une visite = un visiteur par jour" />
        <StatCard
          label="Ont cherché des dates"
          value={String(report.searched)}
          sub={visits > 0 ? `${percent.format(report.searched / visits)} des visites` : undefined}
        />
        <StatCard
          label="Ont ouvert la réservation"
          value={String(report.opened)}
          sub={visits > 0 ? `${percent.format(report.opened / visits)} des visites` : undefined}
        />
        <StatCard
          label="Taux de réservation"
          value={report.conversionRate === null ? "—" : percentOne.format(report.conversionRate)}
          sub={`${report.booking.confirmed} confirmée${report.booking.confirmed > 1 ? "s" : ""} sur ${visits} visite${visits > 1 ? "s" : ""}`}
        />
      </div>

      <Card className="mb-6 p-5">
        <div className="mb-4 text-[13px] font-semibold">Du visiteur à la réservation</div>
        <ol className="space-y-3">
          {funnel.map((step, index) => {
            const lost = index > 0 ? funnel[index - 1].count - step.count : 0;
            return (
              <li key={step.label}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                  <span>{step.label}</span>
                  <span className="tabular-nums text-muted">
                    <strong className="font-semibold text-foreground">{step.count}</strong>
                    {visits > 0 ? ` · ${percentOne.format(step.count / visits)}` : ""}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-border-light">
                  <div className="h-2 rounded-full bg-navy" style={{ width: `${visits > 0 ? Math.min(100, (step.count / visits) * 100) : 0}%` }} />
                </div>
                {index > 0 && lost > 0 && <div className="mt-0.5 text-[11px] text-muted">{lost} de moins que l&apos;étape précédente</div>}
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-[12px] text-muted">
          Les trois premières étapes viennent du suivi anonyme; les deux dernières, de vos réservations. Quelqu&apos;un qui revient un
          autre jour compte pour une nouvelle visite.{" "}
          <Link href="/dashboard/abandons" className="font-medium text-navy underline">
            Voir les réservations abandonnées
          </Link>
        </p>
      </Card>

      <Card className="mb-6 p-5">
        <div className="mb-3 text-[13px] font-semibold">Visites par jour</div>
        <DailyVisitsChart data={report.daily} />
      </Card>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <BarList title="D'où viennent les visiteurs" rows={asRows(report.sources, visits)} empty="Pas encore de données." />
        <BarList title="Appareils" rows={asRows(report.devices, visits)} empty="Pas encore de données." />
        <BarList title="Régions" rows={asRows(report.regions, visits)} empty="Pas encore de données." />
        <BarList
          title="Pages les plus vues"
          rows={report.pages.map((page) => ({
            label: PAGE_LABEL[page.path] ?? page.path,
            value: page.views,
            note: `${page.visits} visite${page.visits > 1 ? "s" : ""}`,
          }))}
          empty="Pas encore de données."
        />
      </div>

      <p className="text-[12px] text-muted">
        Mesure anonyme : aucun témoin, aucun nom ni courriel, et rien qui relie une visite à une réservation. L&apos;empreinte d&apos;un
        visiteur change chaque jour. Ne sont pas comptés : les robots, les visiteurs qui ont activé « Ne pas me suivre » et vos
        propres visites lorsque vous êtes connecté à la console.
      </p>
    </div>
  );
}
