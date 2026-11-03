"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";
import type { AdminRole } from "@/lib/constants";

type Item = { href: string; label: string; ownerOnly: boolean };
type Group = { label: string; items: Item[] };

// The console's menu, as a column on the left: a few entries on their own and a group that opens (reports, traffic and
// abandoned bookings are all ways of looking at how the site is doing).
export const MENU: (Item | Group)[] = [
  { href: "/dashboard", label: "Tableau de bord", ownerOnly: false },
  { href: "/dashboard/clients", label: "Clients", ownerOnly: true },
  {
    label: "Analyse",
    items: [
      { href: "/dashboard/rapports", label: "Rapports", ownerOnly: true },
      { href: "/dashboard/trafic", label: "Trafic", ownerOnly: true },
      { href: "/dashboard/abandons", label: "Abandons", ownerOnly: true },
    ],
  },
  { href: "/dashboard/comptabilite", label: "Comptabilité", ownerOnly: true },
  { href: "/dashboard/journal", label: "Journal", ownerOnly: true },
  { href: "/dashboard/employes", label: "Employés", ownerOnly: true },
  { href: "/dashboard/securite", label: "Sécurité", ownerOnly: false },
];

const isGroup = (entry: Item | Group): entry is Group => "items" in entry;

const linkClass = (active: boolean, nested = false) =>
  `flex items-center gap-1.5 whitespace-nowrap rounded-md py-2 pr-3 text-[13px] font-medium ${nested ? "pl-8" : "pl-3"} ${
    active ? "bg-tint text-navy" : "text-muted hover:bg-hover hover:text-foreground"
  }`;

// `problemCount`: events to look at in the journal (a failed e-mail, a refused deposit...), shown next to its entry.
export function DashboardNav({ role, problemCount = 0 }: { role: AdminRole; problemCount?: number }) {
  const pathname = usePathname() ?? "";
  // Phones: the column is a "Menu" button that opens the list. A group stays open while one of its pages is open.
  const [menuOpen, setMenuOpen] = useState(false);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const isActive = (item: Item) => (item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href));
  const visible = (item: Item) => role === "owner" || !item.ownerOnly;

  function link(item: Item, nested = false) {
    const active = isActive(item);
    const alerts = item.href === "/dashboard/journal" ? problemCount : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={() => setMenuOpen(false)}
        className={linkClass(active, nested)}
      >
        {item.label}
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
  }

  return (
    <div className="md:sticky md:top-4 md:w-52 md:shrink-0 md:self-start">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-controls="console-menu"
        className="flex w-full items-center gap-2 rounded-md border border-border-light bg-white px-3 py-2 text-[13px] font-medium text-foreground md:hidden"
      >
        <Menu size={16} aria-hidden /> Menu
      </button>
      <nav id="console-menu" aria-label="Console" className={`${menuOpen ? "mt-2 block" : "hidden"} md:mt-0 md:block`}>
        <ul className="flex flex-col gap-0.5 rounded-lg border border-border-light bg-white p-2 md:border-0 md:bg-transparent md:p-0">
          {MENU.map((entry) => {
            if (!isGroup(entry)) return visible(entry) ? <li key={entry.href}>{link(entry)}</li> : null;
            const items = entry.items.filter(visible);
            if (items.length === 0) return null;
            const open = toggled[entry.label] ?? items.some(isActive);
            return (
              <li key={entry.label}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setToggled((state) => ({ ...state, [entry.label]: !open }))}
                  className="flex w-full items-center gap-1.5 rounded-md py-2 pl-3 pr-3 text-left text-[13px] font-medium text-muted hover:bg-hover hover:text-foreground"
                >
                  {entry.label}
                  <ChevronDown size={14} aria-hidden className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && <ul className="flex flex-col gap-0.5">{items.map((item) => <li key={item.href}>{link(item, true)}</li>)}</ul>}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
