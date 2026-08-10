"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Settings2, Trash2, LayoutGrid, List, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ReservationModal } from "@/components/admin/ReservationModal";
import type { FleetBoardData } from "@/lib/admin/board";
import { TRAILER_SIZE, TRAILER_STATUS } from "@/lib/constants";

const MONTH_LABELS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const STATUS_LABEL_FR: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

const TRAILER_COLORS = [
  { bg: "#E4EEF4", border: "#2F6690", text: "#173A50" },
  { bg: "#E4F1F5", border: "#3E8FB0", text: "#1B4653" },
  { bg: "#EAEFF4", border: "#5B7B9A", text: "#293F52" },
  { bg: "#E1EAEF", border: "#26536F", text: "#152C3A" },
  { bg: "#E5EFF1", border: "#4C8398", text: "#213B44" },
  { bg: "#EBE8F2", border: "#6B5B95", text: "#332C4C" },
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

function useIsNarrow(breakpointPx: number): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${breakpointPx}px)`).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const handler = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpointPx]);
  return narrow;
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "warn" | "danger" }) {
  const valueClass =
    tone === "warn" ? "text-[#8a5a1c]" : tone === "danger" ? "text-red-600" : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-heading mt-0.5 text-xl ${valueClass}`}>{value}</div>
    </Card>
  );
}

export function FleetBoard({ board }: { board: FleetBoardData }) {
  const router = useRouter();
  const { year, month, trailers, monthReservations, fleetSize, availableToday, toConfirmCount, conflictReservationIds } =
    board;
  const conflictSet = useMemo(() => new Set(conflictReservationIds), [conflictReservationIds]);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const trailerOptions = trailers.map((t, i) => ({ id: t.id, number: i + 1, name: t.name, size: t.size }));
  const colorFor = (trailerId: string) => {
    const idx = trailers.findIndex((t) => t.id === trailerId);
    return TRAILER_COLORS[idx % TRAILER_COLORS.length];
  };

  const isNarrow = useIsNarrow(680);
  const [view, setView] = useState<"grille" | "agenda">("agenda");
  const activeView = isNarrow ? "agenda" : view;

  const [search, setSearch] = useState("");
  const [fleetOpen, setFleetOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [newTrailer, setNewTrailer] = useState({ name: "", size: TRAILER_SIZE[0] as string });
  const [savingTrailer, setSavingTrailer] = useState(false);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  function openBlankCreate() {
    const today = new Date().toISOString().slice(0, 10);
    setModal({ mode: "create", trailerId: trailerOptions[0]?.id ?? "", pickupDate: today });
  }

  const filteredReservations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? monthReservations.filter(
          (r) => r.clientName.toLowerCase().includes(q) || r.clientPhone.toLowerCase().includes(q)
        )
      : monthReservations;
    return [...list].sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
  }, [monthReservations, search]);

  async function handleTrailerUpdate(id: string, data: Record<string, string>) {
    setFleetError(null);
    const res = await fetch(`/api/admin/trailers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFleetError(body.error ?? "Impossible d'enregistrer");
      return;
    }
    router.refresh();
  }

  async function handleTrailerRemove(id: string) {
    setFleetError(null);
    const res = await fetch(`/api/admin/trailers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFleetError(body.error ?? "Impossible de retirer cette remorque");
      return;
    }
    router.refresh();
  }

  async function handleTrailerAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTrailer.name.trim()) return;
    setFleetError(null);
    setSavingTrailer(true);
    try {
      const res = await fetch("/api/admin/trailers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTrailer),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFleetError(body.error ?? "Impossible d'ajouter la remorque");
        return;
      }
      setNewTrailer({ name: "", size: TRAILER_SIZE[0] });
      router.refresh();
    } finally {
      setSavingTrailer(false);
    }
  }

  async function quickConfirm(reservationId: string) {
    await fetch(`/api/admin/reservations/${reservationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="font-heading text-lg">Calendrier de la flotte</div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setFleetOpen((v) => !v)}>
            <Settings2 size={14} /> Flotte
          </Button>
          <Button type="button" variant="cta" onClick={openBlankCreate}>
            <Plus size={14} /> Réservation
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 sm:w-2/3 lg:w-1/2">
        <StatCard label="Dispo. aujourd'hui" value={`${availableToday} / ${fleetSize}`} />
        <StatCard label="À confirmer" value={toConfirmCount} tone={toConfirmCount > 0 ? "warn" : undefined} />
        <StatCard
          label="Conflits"
          value={conflictReservationIds.length / 2 || 0}
          tone={conflictReservationIds.length > 0 ? "danger" : undefined}
        />
      </div>

      {fleetOpen && (
        <Card className="mb-4 p-4">
          <div className="mb-2 font-heading text-[13px]">Gestion de la flotte</div>
          {fleetError && <div className="mb-2 text-[13px] text-red-600">{fleetError}</div>}
          <div className="space-y-2">
            {trailers.map((t, i) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 border-b border-border-light pb-2 text-[13px]">
                <span
                  className="h-3 w-3 shrink-0 rounded-[3px]"
                  style={{ background: TRAILER_COLORS[i % TRAILER_COLORS.length].border }}
                />
                <span className="w-5 text-muted">{i + 1}</span>
                <input
                  defaultValue={t.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== t.name) {
                      handleTrailerUpdate(t.id, { name: e.target.value.trim() });
                    }
                  }}
                  className="w-32 rounded-md border border-border px-2 py-1"
                />
                <select
                  defaultValue={t.size}
                  onChange={(e) => handleTrailerUpdate(t.id, { size: e.target.value })}
                  className="rounded-md border border-border px-2 py-1"
                >
                  {TRAILER_SIZE.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  defaultValue={t.status}
                  onChange={(e) => handleTrailerUpdate(t.id, { status: e.target.value })}
                  className="rounded-md border border-border px-2 py-1"
                >
                  {TRAILER_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleTrailerRemove(t.id)}
                  className="ml-auto text-muted hover:text-red-600"
                  title="Retirer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleTrailerAdd} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              placeholder="Nom (ex. 5x10-02)"
              value={newTrailer.name}
              onChange={(e) => setNewTrailer((v) => ({ ...v, name: e.target.value }))}
              className="w-40 rounded-md border border-border px-2 py-1.5 text-[13px]"
            />
            <select
              value={newTrailer.size}
              onChange={(e) => setNewTrailer((v) => ({ ...v, size: e.target.value }))}
              className="rounded-md border border-border px-2 py-1.5 text-[13px]"
            >
              {TRAILER_SIZE.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={savingTrailer}>
              <Plus size={14} /> Ajouter
            </Button>
          </form>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="font-heading text-[15px]">
            {MONTH_LABELS_FR[month - 1]} {year}
          </div>
          <Link
            href={`/dashboard?year=${prevYear}&month=${prevMonth}`}
            className="rounded-md border border-border px-2.5 py-1 text-[13px] hover:bg-[#EDF2F4]"
          >
            ←
          </Link>
          <Link
            href={`/dashboard?year=${nextYear}&month=${nextMonth}`}
            className="rounded-md border border-border px-2.5 py-1 text-[13px] hover:bg-[#EDF2F4]"
          >
            →
          </Link>
        </div>
        <div className="flex rounded-md border border-border">
          <button
            type="button"
            onClick={() => setView("agenda")}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[13px] ${view === "agenda" ? "bg-[#E4EEF4] text-navy" : "bg-white"}`}
          >
            <List size={14} /> Agenda
          </button>
          {!isNarrow && (
            <button
              type="button"
              onClick={() => setView("grille")}
              className={`flex items-center gap-1 border-l border-border px-2.5 py-1.5 text-[13px] ${view === "grille" ? "bg-[#E4EEF4] text-navy" : "bg-white"}`}
            >
              <LayoutGrid size={14} /> Grille
            </button>
          )}
        </div>
      </div>

      {activeView === "grille" && (
        <div className="mb-4 overflow-x-auto rounded-lg border border-border-light">
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
              {trailers.map((trailer, rowIndex) => {
                const color = TRAILER_COLORS[rowIndex % TRAILER_COLORS.length];
                const monthFirstIso = isoDateForDay(year, month, 1);
                const monthLastIso = isoDateForDay(year, month, daysInMonth);

                const blocks = monthReservations
                  .filter((r) => r.trailerId === trailer.id)
                  .map((r) => {
                    const clippedStartIso = r.pickupDate < monthFirstIso ? monthFirstIso : r.pickupDate;
                    const lastOccupiedIso = new Date(
                      new Date(`${r.returnDate}T00:00:00Z`).getTime() - 86400000
                    )
                      .toISOString()
                      .slice(0, 10);
                    const clippedEndIso = lastOccupiedIso > monthLastIso ? monthLastIso : lastOccupiedIso;
                    return {
                      reservation: r,
                      startDay: Number(clippedStartIso.slice(8, 10)),
                      endDay: Number(clippedEndIso.slice(8, 10)),
                    };
                  })
                  .sort((a, b) => a.startDay - b.startDay);

                const cells = [];
                let day = 1;
                while (day <= daysInMonth) {
                  const block = blocks.find((b) => b.startDay === day);
                  if (block) {
                    const span = Math.max(1, block.endDay - block.startDay + 1);
                    const r = block.reservation;
                    const isConflict = conflictSet.has(r.id);
                    cells.push(
                      <td
                        key={day}
                        colSpan={span}
                        title={`${r.clientName}${r.note ? " — " + r.note : ""}`}
                        onClick={() => setModal({ mode: "edit", reservationId: r.id })}
                        style={{
                          background: color.bg,
                          color: color.text,
                          borderLeft: `2px solid ${isConflict ? "#dc2626" : color.border}`,
                          borderTop: r.status === "pending" ? "1px dashed #8a5a1c" : undefined,
                          borderBottom: r.status === "pending" ? "1px dashed #8a5a1c" : undefined,
                        }}
                        className="cursor-pointer whitespace-nowrap px-1 py-1.5 text-center font-medium hover:opacity-80"
                      >
                        {span >= 2 ? r.clientName.split(" ").slice(-1)[0] : ""}
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
                            trailerId: trailer.id,
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
                  <tr key={trailer.id}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5 font-medium">
                      {rowIndex + 1} — {trailer.name}
                    </td>
                    {cells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[14px] font-medium">
            Réservations — {MONTH_LABELS_FR[month - 1]} {year}
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client..."
              className="w-56 pl-8"
            />
          </div>
        </div>
        <div className="space-y-2">
          {filteredReservations.length === 0 && (
            <div className="rounded-lg border border-border-light bg-[#FAFBFB] p-4 text-center text-[13px] text-muted">
              Aucune réservation ce mois-ci.
            </div>
          )}
          {filteredReservations.map((r) => {
            const color = colorFor(r.trailerId);
            const trailerOpt = trailerOptions.find((t) => t.id === r.trailerId);
            const isConflict = conflictSet.has(r.id);
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-[13px]"
                style={{ borderColor: isConflict ? "#dc2626" : "var(--color-border-light)" }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: color.border }}
                  title={trailerOpt ? `${trailerOpt.number} — ${trailerOpt.name}` : ""}
                />
                <div className="min-w-[140px]">
                  <div className="font-medium">{r.clientName}</div>
                  <div className="text-muted">{r.clientPhone}</div>
                </div>
                <div className="min-w-[160px]">
                  <div>
                    {r.pickupDate}
                    {r.pickupTime ? ` ${r.pickupTime}` : ""} → {r.returnDate}
                    {r.returnTime ? ` ${r.returnTime}` : ""}
                  </div>
                  <div className="text-muted">
                    {trailerOpt ? `${trailerOpt.number} — ${trailerOpt.name}` : ""}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {isConflict && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-700">Conflit</span>
                  )}
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px]"
                    style={{ background: color.bg, color: color.text }}
                  >
                    {STATUS_LABEL_FR[r.status] ?? r.status}
                  </span>
                  {r.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => quickConfirm(r.id)}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] hover:bg-[#EDF2F4]"
                    >
                      <Check size={12} /> Confirmer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setModal({ mode: "edit", reservationId: r.id })}
                    className="rounded-md border border-border px-2 py-1 text-[12px] hover:bg-[#EDF2F4]"
                  >
                    Modifier
                  </button>
                </div>
                {r.note && <div className="basis-full pl-[22px] text-[12px] text-[#8a5a1c]">{r.note}</div>}
              </div>
            );
          })}
        </div>
      </Card>

      {modal && (
        <ReservationModal
          key={modal.mode === "edit" ? modal.reservationId : `create-${modal.trailerId}-${modal.pickupDate}`}
          state={modal}
          trailers={trailerOptions}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
