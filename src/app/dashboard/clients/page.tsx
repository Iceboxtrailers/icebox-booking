import { getAllClients } from "@/lib/admin/clients";
import { ClientsTable } from "@/components/admin/ClientsTable";
import { requireOwnerPage } from "@/lib/admin-auth";

export default async function ClientsPage() {
  await requireOwnerPage();
  const clients = await getAllClients();

  return (
    <div>
      <h1 className="font-heading mb-6 text-2xl">Clients</h1>
      <ClientsTable clients={clients} />
    </div>
  );
}
