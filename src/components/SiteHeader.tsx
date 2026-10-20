"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { User, LogOut, ChevronDown } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { buttonClassName } from "@/components/ui/Button";

const NAV_ITEMS = [
  { label: "Nos remorques", href: "/#remorques" },
  { label: "Comment ça marche", href: "/comment-ca-marche" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

const OTHER_SERVICES = [
  { label: "Chambres froides", href: "/chambre-froide" },
  { label: "Chambres de congélation", href: "/chambre-congelation" },
  { label: "Accessoires", href: "/attaches-accessoires" },
  { label: "Devenir concessionnaire", href: "/devenir-concessionnaire" },
];

function OtherServicesMenu({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-1 text-[13px] font-medium text-foreground hover:text-navy"
      >
        Autres services <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-2 min-w-[200px] rounded-lg border border-border-light bg-white py-1.5 shadow-md">
          {OTHER_SERVICES.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="block px-4 py-2 text-[13px] text-foreground hover:bg-page hover:text-navy"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function SiteHeader() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-border-light bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/" aria-label="IceBox — accueil" className="flex items-center">
          <BrandLogo height={52} priority />
        </Link>

        <nav className="hidden flex-1 items-center gap-5 sm:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="text-[13px] font-medium text-foreground hover:text-navy">
              {item.label}
            </Link>
          ))}
          <OtherServicesMenu />
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <div className="hidden sm:block">
            <Link href="/reservation/invite" className={buttonClassName("cta", "sm")}>
              Réserver
            </Link>
          </div>
          {session ? (
            <>
              {!session.guest && (
                <Link href="/compte" className="flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-navy">
                  <User size={16} />
                  Mon compte
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-navy"
              >
                <LogOut size={16} />
                Déconnexion
              </button>
            </>
          ) : (
            <Link href="/login" className="flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-navy">
              <User size={16} />
              Connexion
            </Link>
          )}
        </div>
      </div>

      <nav className="flex items-center gap-4 overflow-x-auto border-t border-border-light px-4 py-2 sm:hidden">
        <Link href="/reservation/invite" className="whitespace-nowrap text-[12px] font-medium text-cta">
          Réserver
        </Link>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="whitespace-nowrap text-[12px] font-medium text-foreground">
            {item.label}
          </Link>
        ))}
        {OTHER_SERVICES.map((item) => (
          <Link key={item.href} href={item.href} className="whitespace-nowrap text-[12px] text-muted">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
