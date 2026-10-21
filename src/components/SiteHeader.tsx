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

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <Link href="/reservation/invite" className={buttonClassName("cta", "sm")}>
            Réserver
          </Link>
          {/* On a phone the account links are icons only: the booking button keeps the room. */}
          {session ? (
            <>
              {!session.guest && (
                <Link href="/compte" aria-label="Mon compte" className="flex items-center gap-1.5 p-2 text-[13px] font-medium text-foreground hover:text-navy">
                  <User size={18} />
                  <span className="hidden sm:inline">Mon compte</span>
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                aria-label="Déconnexion"
                className="flex items-center gap-1.5 p-2 text-[13px] font-medium text-foreground hover:text-navy"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </>
          ) : (
            <Link href="/login" className="flex items-center gap-1.5 p-2 text-[13px] font-medium text-foreground hover:text-navy">
              <User size={18} />
              Connexion
            </Link>
          )}
        </div>
      </div>

      {/* Phones: the other pages in a strip that scrolls sideways; the fade on the right says there is more. */}
      <div className="relative sm:hidden">
        <nav className="flex items-center gap-5 overflow-x-auto border-t border-border-light px-4">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap py-2.5 text-[13px] font-medium text-foreground">
              {item.label}
            </Link>
          ))}
          {OTHER_SERVICES.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap py-2.5 text-[13px] text-muted">
              {item.label}
            </Link>
          ))}
        </nav>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />
      </div>
    </header>
  );
}
