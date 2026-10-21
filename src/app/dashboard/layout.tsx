import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { BrandMark } from "@/components/BrandMark";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { DashboardNav } from "@/components/admin/DashboardNav";
import { adminPwaMetadata, adminPwaViewport } from "@/lib/admin-pwa-metadata";

export const metadata = adminPwaMetadata;
export const viewport = adminPwaViewport;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login?callbackUrl=/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-light bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2.5 px-4 pt-3 md:flex-nowrap md:pb-3">
          <BrandMark size={28} />
          <span className="font-heading text-base uppercase tracking-wide">Console Admin</span>
          {/* Phones: the tabs sit on their own line and scroll sideways; from "md" up they join the header row. */}
          <div className="order-last -mx-4 mt-2 w-[calc(100%+2rem)] overflow-x-auto border-t border-border-light px-4 py-1.5 md:order-none md:mx-0 md:ml-6 md:mt-0 md:w-auto md:overflow-visible md:border-0 md:p-0">
            <DashboardNav role={admin.role} />
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
