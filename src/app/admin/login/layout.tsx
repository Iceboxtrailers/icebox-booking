import { ReactNode } from "react";
import { adminPwaMetadata, adminPwaViewport } from "@/lib/admin-pwa-metadata";

export const metadata = adminPwaMetadata;
export const viewport = adminPwaViewport;

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
