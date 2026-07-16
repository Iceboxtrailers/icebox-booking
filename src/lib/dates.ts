// Date helpers on plain "YYYY-MM-DD" strings, mirroring the original prototype
// (prototype-site-location.jsx: addDays / fmt / nights).

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function nights(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  const start = new Date(`${a}T00:00:00Z`).getTime();
  const end = new Date(`${b}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((end - start) / 86400000));
}
