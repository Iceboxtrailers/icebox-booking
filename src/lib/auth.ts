import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema, adminLoginSchema } from "@/lib/validation";
import { authConfig } from "@/lib/auth.config";
import { verifyAdminLogin } from "@/lib/admin-login";
import { hashGuestToken } from "@/lib/guest";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Courriel", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (rawCredentials) => {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        // Only real accounts sign in with a password; guest records have none.
        const client = await prisma.client.findFirst({
          where: { email: parsed.data.email, hasAccount: true },
        });
        if (!client || client.status !== "active") return null;

        const passwordOk = await bcrypt.compare(parsed.data.password, client.passwordHash);
        if (!passwordOk) return null;

        return {
          id: client.id,
          email: client.email,
          name: `${client.firstName} ${client.lastName}`,
        };
      },
    }),
    // Booking without an account: exchanges the one-time token from /api/guest/start for a
    // short session (see GUEST_SESSION_MS) limited to that single booking record.
    Credentials({
      id: "guest-session",
      name: "Invité",
      credentials: { token: { label: "Jeton", type: "text" } },
      authorize: async (rawCredentials) => {
        const token = typeof rawCredentials?.token === "string" ? rawCredentials.token : "";
        if (token.length < 20) return null;

        const tokenHash = hashGuestToken(token);
        const client = await prisma.client.findFirst({
          where: { hasAccount: false, status: "active", resetTokenHash: tokenHash, resetTokenExpiresAt: { gt: new Date() } },
        });
        if (!client) return null;

        // Single use: only the request that clears the token gets the session.
        const { count } = await prisma.client.updateMany({
          where: { id: client.id, resetTokenHash: tokenHash },
          data: { resetTokenHash: null, resetTokenExpiresAt: null },
        });
        if (count !== 1) return null;

        return { id: client.id, email: client.email, name: `${client.firstName} ${client.lastName}` };
      },
    }),
    Credentials({
      id: "admin-credentials",
      name: "Admin",
      credentials: {
        username: { label: "Nom d'utilisateur", type: "text" },
        password: { label: "Mot de passe", type: "password" },
        code: { label: "Code de vérification", type: "text" },
      },
      authorize: async (rawCredentials) => {
        const parsed = adminLoginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        // Password, lockout and two-factor checks live in one place (case-insensitive username).
        const result = await verifyAdminLogin(parsed.data);
        if (!result.ok) return null;

        return { id: result.admin.id, name: result.admin.username };
      },
    }),
  ],
});
