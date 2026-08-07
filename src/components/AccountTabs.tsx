"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Mon compte", href: "/compte" },
  { label: "Mes réservations", href: "/compte/reservations" },
];

export function AccountTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-4 border-b border-border-light">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-1 pb-2.5 text-[13px] font-medium ${
              active ? "border-navy text-navy" : "border-transparent text-muted hover:text-navy"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
