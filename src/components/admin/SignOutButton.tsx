"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/admin/login" })}
      aria-label="Déconnexion"
      className="ml-auto flex items-center gap-1.5 p-2 text-[13px] font-medium text-foreground hover:text-navy"
    >
      <LogOut size={18} />
      <span className="hidden sm:inline">Déconnexion</span>
    </button>
  );
}
