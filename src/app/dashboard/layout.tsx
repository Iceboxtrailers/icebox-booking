import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { countRecentProblems } from "@/lib/admin/audit";
import { BrandMark } from "@/components/BrandMark";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { DashboardNav } from "@/components/admin/DashboardNav";
import { adminPwaMetadata, adminPwaViewport } from "@/lib/admin-pwa-metadata";

export const metadata = adminPwaMetadata;
export const viewport = adminPwaViewport;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login?callbackUrl=/dashboard");

  // What went wrong lately (shown next to the Journal entry). A failed lookup must never keep the console from opening.
  const problemCount = admin.role === "owner" ? await countRecentProblems().catch(() => 0) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-light bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-x-2.5 px-4 py-3">
          <BrandMark size={28} />
          <span className="font-heading text-base uppercase tracking-wide">Console Admin</span>
          <SignOutButton />
        </div>
      </header>
      {/* From "md" up the menu is a column on the left; on phones it is a button above the page. */}
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 md:flex-row md:gap-8">
        <DashboardNav role={admin.role} problemCount={problemCount} />
        <main className="min-w-0 flex-1 md:py-1">{children}</main>
      </div>
    </div>
  );
}
