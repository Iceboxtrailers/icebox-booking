import type { Metadata } from "next";
import { ReactNode } from "react";

// Booking, sign-in and password pages are for customers who are already on the site: never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrivateAreaLayout({ children }: { children: ReactNode }) {
  return children;
}
