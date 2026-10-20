import { auth } from "@/lib/auth";

// The booking record signed in right now: a real account or a guest (booking without an account).
export async function getCurrentClientId(): Promise<string | null> {
  const session = await auth();
  return session?.clientId ?? null;
}

// Same, but only for a real account. Guests have no client area: they never see account pages
// or account settings, only their own booking through the reservation wizard.
export async function getCurrentAccountId(): Promise<string | null> {
  const session = await auth();
  return session?.guest ? null : (session?.clientId ?? null);
}

export async function getCurrentAdminId(): Promise<string | null> {
  const session = await auth();
  return session?.adminId ?? null;
}
