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
  { href: "/dashboard/employes", label: "Employés", ownerOnly: true },
  { href: "/dashboard/securite", label: "Sécurité", ownerOnly: false },
];

export function DashboardNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {TABS.filter((tab) => role === "owner" || !tab.ownerOnly).map((tab) => {
        const active = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
              active ? "bg-tint text-navy" : "text-muted hover:bg-hover hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
