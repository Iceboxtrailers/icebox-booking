import { ReportsForm } from "@/components/admin/ReportsForm";
import { requireOwnerPage } from "@/lib/admin-auth";

export default async function ReportsPage() {
  await requireOwnerPage();
  return (
    <div>
      <h1 className="font-heading mb-6 text-2xl">Rapports</h1>
      <p className="mb-4 text-[13px] text-muted">
        Génère un PDF de l&apos;historique des locations (confirmées, en cours ou terminées) pour la période
        choisie, avec les montants associés.
      </p>
      <ReportsForm />
    </div>
  );
}
