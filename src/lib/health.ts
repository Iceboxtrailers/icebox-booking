import { timingSafeEqual } from "node:crypto";

// What the health page reports: one line per outside service the site depends on. Each check is a light, read-only
// call; its failure is reported by name and a short reason, never with a key or a token.
export type ServiceStatus = { status: "ok" | "fail" | "skipped"; ms: number; detail?: string };
export type HealthReport = { ok: boolean; checkedAt: string; services: Record<string, ServiceStatus> };

// A check returns a short note when it passes (or "skipped: reason" when the service is not set up), and throws when
// the service does not answer as it should.
export type HealthCheck = () => Promise<string | void>;

export const CHECK_TIMEOUT_MS = 8000;

// Keys, bearer tokens and long secrets are cut out of anything reported.
export function safeMessage(error: unknown): string {
  // Some drivers throw an event or a plain object rather than an Error.
  const message = typeof error === "object" && error !== null && "message" in error ? String((error as { message: unknown }).message) : "";
  const text =
    error instanceof Error
      ? error.message
      : message || (typeof error === "object" && error !== null ? `erreur ${error.constructor?.name ?? "inconnue"}` : String(error));
  return text
    .replace(/(sk|rk|pk|re|whsec)_[A-Za-z0-9_]{6,}/g, "[clé masquée]")
    .replace(/Bearer\s+\S+/gi, "Bearer [masqué]")
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

export async function runHealthChecks(checks: Record<string, HealthCheck>, timeoutMs = CHECK_TIMEOUT_MS): Promise<HealthReport> {
  const entries = await Promise.all(
    Object.entries(checks).map(async ([name, check]): Promise<[string, ServiceStatus]> => {
      const started = Date.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const note = await Promise.race([
          check(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`pas de réponse en ${Math.round(timeoutMs / 1000)} s`)), timeoutMs);
          }),
        ]);
        const ms = Date.now() - started;
        if (typeof note === "string" && note.startsWith("skipped")) return [name, { status: "skipped", ms, detail: note.replace(/^skipped:?\s*/, "") || undefined }];
        return [name, { status: "ok", ms, ...(note ? { detail: note } : {}) }];
      } catch (error) {
        return [name, { status: "fail", ms: Date.now() - started, detail: safeMessage(error) }];
      } finally {
        if (timer) clearTimeout(timer);
      }
    }),
  );
  const services = Object.fromEntries(entries);
  return { ok: entries.every(([, s]) => s.status !== "fail"), checkedAt: new Date().toISOString(), services };
}

// The page answers only to whoever holds the token (a missing or empty token on either side never matches).
export function tokenMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
