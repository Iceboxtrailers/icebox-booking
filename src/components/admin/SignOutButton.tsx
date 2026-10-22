"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();

  // Ends the console session only (its own cookie): a booking session open in the same browser stays.
  async function signOutOfConsole() {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={signOutOfConsole}
      aria-label="Déconnexion"
      className="ml-auto flex items-center gap-1.5 p-2 text-[13px] font-medium text-foreground hover:text-navy"
    >
      <LogOut size={18} />
      <span className="hidden sm:inline">Déconnexion</span>
    </button>
  );
}
