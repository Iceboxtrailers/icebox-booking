import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { MfaPanel } from "@/components/admin/MfaPanel";

export default async function SecurityPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login?callbackUrl=/dashboard/securite");
  const row = await prisma.adminUser.findUnique({ where: { id: admin.id }, select: { totpEnabledAt: true } });

  return (
    <div>
      <h1 className="font-heading mb-2 text-2xl">Sécurité</h1>
      <p className="mb-6 max-w-md text-[13px] text-muted">
        Compte : <strong>{admin.username}</strong>. La double authentification ajoute un code temporaire de votre
        téléphone à la connexion.
      </p>
      <MfaPanel enabled={Boolean(row?.totpEnabledAt)} />
    </div>
  );
}
