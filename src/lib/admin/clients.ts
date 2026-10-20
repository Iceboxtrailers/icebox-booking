import { prisma } from "@/lib/prisma";

export const CLIENT_LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  company: true,
  email: true,
  phone: true,
  status: true,
  hasAccount: true,
  billingCity: true,
  billingProvince: true,
  createdAt: true,
  _count: { select: { reservations: true } },
} as const;

export type ClientListItem = {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  email: string;
  phone: string;
  status: string;
  /** true = real account that can sign in; false = admin-only record (guest booking or entered by staff) */
  hasAccount: boolean;
  billingCity: string | null;
  billingProvince: string | null;
  createdAt: Date;
  _count: { reservations: number };
};

// A blocked status wins when several records of the same person are shown as one line.
const STATUS_SEVERITY: Record<string, number> = { active: 0, suspended: 1, blacklisted: 2 };

// Every guest booking is its own record, so one person who rents several times has several
// records with the same email. The admin list shows them as ONE line: the oldest record (the
// one staff may have filled in) with the reservations of all of them.
export function groupClientRows(rows: ClientListItem[]): ClientListItem[] {
  const accounts = rows.filter((row) => row.hasAccount);
  const byEmail = new Map<string, ClientListItem[]>();
  for (const row of rows) {
    if (row.hasAccount) continue;
    const key = row.email.toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), row]);
  }

  const merged = [...byEmail.values()].map((group) => {
    const [oldest] = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const status = group.reduce((worst, row) => ((STATUS_SEVERITY[row.status] ?? 0) > (STATUS_SEVERITY[worst] ?? 0) ? row.status : worst), "active");
    const reservations = group.reduce((sum, row) => sum + row._count.reservations, 0);
    return { ...oldest, status, _count: { reservations } };
  });

  return [...accounts, ...merged].sort((a, b) => a.lastName.localeCompare(b.lastName, "fr", { sensitivity: "base" }));
}

export async function getAllClients(): Promise<ClientListItem[]> {
  const rows = await prisma.client.findMany({ select: CLIENT_LIST_SELECT, orderBy: { lastName: "asc" } });
  return groupClientRows(rows);
}
