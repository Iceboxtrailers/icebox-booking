import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { getCurrentAdminId } from "@/lib/session";
import { BrandMark } from "@/components/BrandMark";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { DashboardNav } from "@/components/admin/DashboardNav";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const adminId = await getCurrentAdminId();
  if (!adminId) redirect("/admin/login?callbackUrl=/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-light bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-3">
          <BrandMark size={28} />
          <span className="font-heading text-base uppercase tracking-wide">Console Admin</span>
          <div className="ml-6">
            <DashboardNav />
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
