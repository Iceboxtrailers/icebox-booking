import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { authConfig } from "@/lib/auth.config";
import { hashGuestToken } from "@/lib/guest";
import { RATE_RULES, clientIp, overLimit } from "@/lib/rate-limit";

// Lets the login page say "too many attempts" instead of "wrong password".
class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Courriel", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (rawCredentials, request) => {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        // Too many tries for this email, or from this address: stop before any password is checked.
        const byEmail = await overLimit(RATE_RULES.login, parsed.data.email);
        const byIp = await overLimit(RATE_RULES.loginIp, clientIp(request));
        if (byEmail.over || byIp.over) throw new RateLimitedSignin();

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
    // The console does not sign in here: it has its own session (src/lib/admin-session.ts, signed in through
    // /api/admin/auth/login), so the staff and the clients never share a cookie.
  ],
});
