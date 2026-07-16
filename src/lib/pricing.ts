import { nights } from "@/lib/dates";

export { nights };

export function computeTotalCents(dailyRateCents: number, start: string, end: string): number {
  return dailyRateCents * nights(start, end);
}
