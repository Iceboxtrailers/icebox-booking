import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { ADMIN_SESSION_COOKIE, readAdminSessionToken } from "@/lib/admin-session";

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

// The staff member signed in to the console. Separate cookie from the clients' session: being signed in
// to one says nothing about the other. (getCurrentAdmin in admin-auth.ts also checks the account still exists.)
export async function getCurrentAdminId(): Promise<string | null> {
  const jar = await cookies();
  const session = await readAdminSessionToken(jar.get(ADMIN_SESSION_COOKIE)?.value);
  return session?.adminId ?? null;
}
