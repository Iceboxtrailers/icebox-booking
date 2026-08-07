import { auth } from "@/lib/auth";

export async function getCurrentClientId(): Promise<string | null> {
  const session = await auth();
  return session?.clientId ?? null;
}

export async function getCurrentAdminId(): Promise<string | null> {
  const session = await auth();
  return session?.adminId ?? null;
}
