import { prisma } from "@/lib/prisma";

export type ClientListItem = {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  email: string;
  phone: string;
  status: string;
  billingCity: string | null;
  billingProvince: string | null;
  createdAt: Date;
  _count: { reservations: number };
};

export async function getAllClients(): Promise<ClientListItem[]> {
  return prisma.client.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      email: true,
      phone: true,
      status: true,
      billingCity: true,
      billingProvince: true,
      createdAt: true,
      _count: { select: { reservations: true } },
    },
    orderBy: { lastName: "asc" },
  });
}
