"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const MONTH_LABELS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

type ReportType = "month" | "year" | "custom";

export function ReportsForm() {
  const now = new Date();
  const [type, setType] = useState<ReportType>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const params = new URLSearchParams({ type });
    if (type === "month") {
      params.set("year", String(year));
      params.set("month", String(month));
    } else if (type === "year") {
      params.set("year", String(year));
    } else {
      if (!customStart || !customEnd) {
        setError("Choisissez une date de début et une date de fin");
        return;
      }
      if (customEnd < customStart) {
        setError("La date de fin doit être après la date de début");
        return;
      }
      params.set("start", customStart);
      params.set("end", customEnd);
    }

    window.open(`/api/admin/reports?${params.toString()}`, "_blank");
  }

  return (
    <Card className="max-w-md p-5">
      <form onSubmit={handleGenerate}>
        <Field label="Période">
          <div className="flex gap-2">
            {(
              [
                { value: "month", label: "Mensuel" },
                { value: "year", label: "Annuel" },
                { value: "custom", label: "Plage personnalisée" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`rounded-md border px-3 py-1.5 text-[12px] ${
                  type === opt.value ? "border-navy bg-[#E4EEF4]" : "border-border bg-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        {type === "month" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mois">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-md border border-border px-3 py-2.5 text-[13px]"
              >
                {MONTH_LABELS_FR.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Année">
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={2020}
                max={2100}
                required
              />
            </Field>
          </div>
        )}

        {type === "year" && (
          <Field label="Année">
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              min={2020}
              max={2100}
              required
            />
          </Field>
        )}

        {type === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date de début">
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} required />
            </Field>
            <Field label="Date de fin">
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} required />
            </Field>
          </div>
        )}

        {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}

        <Button type="submit" variant="cta" className="w-full justify-center">
          Générer le PDF
        </Button>
      </form>
    </Card>
  );
}
