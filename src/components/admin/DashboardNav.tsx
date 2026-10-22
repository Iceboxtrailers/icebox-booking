"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole } from "@/lib/constants";

const TABS = [
  { href: "/dashboard", label: "Tableau de bord", ownerOnly: false },
  { href: "/dashboard/clients", label: "Clients", ownerOnly: true },
  { href: "/dashboard/rapports", label: "Rapports", ownerOnly: true },
  { href: "/dashboard/trafic", label: "Trafic", ownerOnly: true },
  { href: "/dashboard/abandons", label: "Abandons", ownerOnly: true },
  { href: "/dashboard/comptabilite", label: "Comptabilité", ownerOnly: true },
  { href: "/dashboard/journal", label: "Journal", ownerOnly: true },
  { href: "/dashboard/employes", label: "Employés", ownerOnly: true },
  { href: "/dashboard/securite", label: "Sécurité", ownerOnly: false },
];

// `problemCount`: events to look at in the journal (a failed e-mail, a refused deposit...), shown on its tab.
export function DashboardNav({ role, problemCount = 0 }: { role: AdminRole; problemCount?: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex w-max gap-1">
      {TABS.filter((tab) => role === "owner" || !tab.ownerOnly).map((tab) => {
        const active = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href);
        const alerts = tab.href === "/dashboard/journal" ? problemCount : 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-medium md:py-1.5 ${
              active ? "bg-tint text-navy" : "text-muted hover:bg-hover hover:text-foreground"
            }`}
          >
            {tab.label}
            {alerts > 0 && (
              <>
                <span aria-hidden className="rounded-full bg-red-100 px-1.5 text-[11px] font-semibold text-red-700">
                  {alerts}
                </span>
                <span className="sr-only">, {alerts} à vérifier</span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
