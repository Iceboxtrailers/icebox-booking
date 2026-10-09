import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/admin-auth";
import { EmployeesManager } from "@/components/admin/EmployeesManager";

export default async function EmployeesPage() {
  await requireOwnerPage();
  const employees = await prisma.adminUser.findMany({
    where: { role: "employee" },
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, createdAt: true },
  });

  return (
    <div>
      <h1 className="font-heading mb-6 text-2xl">Employés</h1>
      <EmployeesManager
        employees={employees.map((e) => ({ id: e.id, username: e.username, createdAt: e.createdAt.toISOString() }))}
      />
    </div>
  );
}
