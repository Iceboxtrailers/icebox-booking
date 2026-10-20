import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AccountTabs } from "@/components/AccountTabs";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CompteLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // A booking without an account has no client area.
  if (session?.guest) redirect("/");
  if (!session?.clientId) redirect("/login?callbackUrl=/compte");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="font-heading mb-4 text-2xl">Mon espace client</h1>
        <AccountTabs />
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
