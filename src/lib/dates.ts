// Date helpers on plain "YYYY-MM-DD" strings, mirroring the original prototype
// (prototype-site-location.jsx: addDays / fmt / nights).

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// A "YYYY-MM-DD" string that is a real calendar day. The pattern alone lets "2029-13-45" through (an
// invalid date further on) and "2029-02-30" (silently becomes March 2).
export function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function fmt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// Today's calendar date in Québec time (YYYY-MM-DD), whatever the server's time zone.
export function quebecDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// The start of today's Québec day as a Date at 00:00 UTC: how day-only columns (pickup, return) are stored,
// so it compares directly with them. `new Date()` plus setHours would use the server's own day, which on
// the hosting platform (UTC) already is tomorrow from 8 pm in Québec.
export function quebecToday(): Date {
  return new Date(`${quebecDay()}T00:00:00Z`);
}

export function nights(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  const start = new Date(`${a}T00:00:00Z`).getTime();
  const end = new Date(`${b}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((end - start) / 86400000));
}
