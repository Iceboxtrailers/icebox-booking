"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/dashboard/clients", label: "Clients" },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {TABS.map((tab) => {
        const active = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
              active ? "bg-[#E4EEF4] text-navy" : "text-muted hover:bg-[#EDF2F4] hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
