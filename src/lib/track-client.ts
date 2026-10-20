import type { TrafficEventName } from "@/lib/traffic";

// Browser side of the anonymous audience measurement (see src/lib/traffic.ts): sends one small
// event to /api/track. Nothing is stored in the browser, no identifier is sent, and a failure
// never affects the page.
export function trackEvent(
  name: TrafficEventName,
  path: string = window.location.pathname,
  extra: { referrer?: string; utm?: string } = {},
): void {
  try {
    const body = JSON.stringify({ name, path, ...extra });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch {
    // measuring is best effort
  }
}
