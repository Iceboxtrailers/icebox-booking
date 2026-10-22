import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireOwnerPage } from "@/lib/admin-auth";
import { AUDIT_CATEGORIES, isAuditCategory } from "@/lib/admin/audit-events";
import type { AuditCategory } from "@/lib/admin/audit-events";
import { countRecentProblems, getAuditPage } from "@/lib/admin/audit";

export const metadata = { title: "Journal d'activité — Console IceBox" };

const PERIODS = [7, 30, 90] as const;
const DEFAULT_PERIOD = 30;
const ID_PATTERN = /^[A-Za-z0-9]{10,40}$/;

const dateTime = new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });

type Filters = { cat: AuditCategory | null; jours: number; reservation: string | null };

function journalHref(filters: Filters, before?: string): string {
  const query = new URLSearchParams();
  if (filters.cat) query.set("cat", filters.cat);
  if (filters.jours !== DEFAULT_PERIOD) query.set("jours", String(filters.jours));
  if (filters.reservation) query.set("reservation", filters.reservation);
  if (before) query.set("avant", before);
  const suffix = query.toString();
  return `/dashboard/journal${suffix ? `?${suffix}` : ""}`;
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; jours?: string; reservation?: string; avant?: string }>;
}) {
  await requireOwnerPage();
  const params = await searchParams;
  const filters: Filters = {
    cat: isAuditCategory(params.cat) ? params.cat : null,
    jours: PERIODS.find((period) => period === Number(params.jours)) ?? DEFAULT_PERIOD,
    reservation: params.reservation && ID_PATTERN.test(params.reservation) ? params.reservation : null,
  };
  const before = params.avant && ID_PATTERN.test(params.avant) ? params.avant : undefined;

  const [page, recentProblems] = await Promise.all([
    getAuditPage({ category: filters.cat, days: filters.jours, reservationId: filters.reservation ?? undefined, before }),
    countRecentProblems(),
  ]);
  const reservationLabel = filters.reservation ? page.entries.find((entry) => entry.reservation)?.reservation?.label : null;

  return (
    <div>
      <h1 className="font-heading mb-2 text-2xl">Journal d&apos;activité</h1>
      <p className="mb-5 max-w-2xl text-[13px] text-muted">
        Ce qui s&apos;est passé : dépôts et paiements, contrats signés, documents consultés, courriels qui n&apos;ont pas
        pu partir, comptabilité, changements dans l&apos;équipe. Les plus récents d&apos;abord. Cette page est réservée au
        propriétaire.
      </p>

      {recentProblems > 0 && filters.cat !== "problemes" && (
        <Card className="mb-5 border-warn-line bg-warn-soft p-4 text-[13px]">
          <span className="font-medium text-warn-text">
            {recentProblems} événement{recentProblems > 1 ? "s" : ""} à vérifier ces 7 derniers jours.
          </span>{" "}
          <Link href={journalHref({ cat: "problemes", jours: 7, reservation: null })} className="py-1 text-navy underline">
            Les voir
          </Link>
        </Card>
      )}

      <nav aria-label="Filtrer par sujet" className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
        <Link
          href={journalHref({ ...filters, cat: null })}
          aria-current={filters.cat === null ? "true" : undefined}
          className={`rounded-md px-3 py-1.5 font-medium ${filters.cat === null ? "bg-tint text-navy" : "text-muted hover:bg-hover hover:text-foreground"}`}
        >
          Tout
        </Link>
        {AUDIT_CATEGORIES.map((category) => (
          <Link
            key={category.id}
            href={journalHref({ ...filters, cat: category.id })}
            aria-current={filters.cat === category.id ? "true" : undefined}
            className={`rounded-md px-3 py-1.5 font-medium ${filters.cat === category.id ? "bg-tint text-navy" : "text-muted hover:bg-hover hover:text-foreground"}`}
          >
            {category.label}
          </Link>
        ))}
      </nav>

      <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted">Période :</span>
        {PERIODS.map((days) => (
          <Link
            key={days}
            href={journalHref({ ...filters, jours: days })}
            aria-current={days === filters.jours ? "true" : undefined}
            className={`rounded-md px-3 py-1.5 font-medium ${days === filters.jours ? "bg-tint text-navy" : "text-muted hover:bg-hover hover:text-foreground"}`}
          >
            {days} jours
          </Link>
        ))}
        {filters.reservation && (
          <span className="ml-2 flex flex-wrap items-center gap-2 rounded-md bg-subtle px-3 py-1.5">
            <span>Réservation : {reservationLabel ?? "sans événement sur cette période"}</span>
            <Link href={journalHref({ ...filters, reservation: null })} className="py-1 text-navy underline">
              Retirer le filtre
            </Link>
          </span>
        )}
      </div>

      {page.entries.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-muted">Aucun événement pour ces filtres.</Card>
      ) : (
        <Card className="divide-y divide-border-light">
          <ol>
            {page.entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 px-4 py-3 text-[13px] sm:flex-row sm:items-start sm:gap-4">
                <time dateTime={entry.at.toISOString()} className="shrink-0 tabular-nums text-muted sm:w-44">
                  {dateTime.format(entry.at)}
                </time>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{entry.title}</span>
                    {entry.problem && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-700">À vérifier</span>}
                  </div>
                  {entry.detail && <div className="break-words text-muted">{entry.detail}</div>}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted">
                    <span>Par : {entry.actor}</span>
                    {entry.reservation && (
                      <>
                        <Link href={journalHref({ ...filters, reservation: entry.reservation.id })} className="py-1 text-navy underline">
                          {entry.reservation.label}
                        </Link>
                        {entry.reservation.exists && (
                          <Link href={`/dashboard?year=${entry.reservation.year}&month=${entry.reservation.month}`} className="py-1 text-navy underline">
                            Voir au calendrier
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 text-[13px]">
        {before && (
          <Link href={journalHref(filters)} className="py-1 text-navy underline">
            ← Revenir aux plus récents
          </Link>
        )}
        {page.nextCursor && (
          <Link href={journalHref(filters, page.nextCursor)} className="py-1 text-navy underline">
            Voir les événements plus anciens →
          </Link>
        )}
      </div>
    </div>
  );
}
