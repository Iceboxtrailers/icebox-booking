"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { User, LogOut } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const NAV_ITEMS = [
  { label: "Remorques", href: "/" },
  { label: "Chambre froide", href: "/chambre-froide" },
  { label: "Chambre de congélation", href: "/chambre-congelation" },
  { label: "Attaches & accessoires", href: "/attaches-accessoires" },
];

export function SiteHeader() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-border-light bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={32} />
          <span className="font-heading text-lg uppercase tracking-wide">IceBox</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-5 sm:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="text-[13px] font-medium text-foreground hover:text-navy">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <Link href="/devenir-concessionnaire" className="hidden text-[13px] font-medium text-muted hover:text-navy sm:inline">
            Devenir concessionnaire
          </Link>
          {session ? (
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-navy"
            >
              <LogOut size={16} />
              Déconnexion
            </button>
          ) : (
            <Link href="/login" className="flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-navy">
              <User size={16} />
              Connexion
            </Link>
          )}
        </div>
      </div>

      <nav className="flex items-center gap-4 overflow-x-auto border-t border-border-light px-4 py-2 sm:hidden">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="whitespace-nowrap text-[12px] font-medium text-foreground">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
