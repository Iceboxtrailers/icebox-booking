"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/track-client";

// Counts page views for the anonymous audience measurement. The admin console is never sent
// (and the server ignores it anyway). The referrer and the campaign tag only go with the first
// page of a visit.
export function Tracker() {
  const pathname = usePathname();
  const firstPage = useRef(true);

  useEffect(() => {
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) return;
    const origin = firstPage.current
      ? { referrer: document.referrer || undefined, utm: new URLSearchParams(window.location.search).get("utm_source") ?? undefined }
      : {};
    firstPage.current = false;
    trackEvent("pageview", pathname, origin);
  }, [pathname]);

  return null;
}
