import type { NextAuthConfig } from "next-auth";
import { GUEST_SESSION_MS } from "@/lib/constants";

// Edge-safe subset of the Auth.js config (no providers, no Prisma) so
// src/middleware.ts can check for a session without pulling the
// Prisma/better-sqlite3 native driver into the Edge Runtime bundle. The full
// config with the Credentials provider lives in src/lib/auth.ts.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    // account.provider tells apart the Credentials providers (client, guest, admin)
    // at sign-in time, so a JWT only ever carries one identity.
    jwt: async ({ token, user, account }) => {
      if (user?.id && account?.provider === "admin-credentials") {
        token.adminId = user.id;
      } else if (user?.id && account?.provider === "guest-session") {
        // A guest session stops working after GUEST_SESSION_MS, whatever the cookie lifetime.
        token.clientId = user.id;
        token.guestUntil = Date.now() + GUEST_SESSION_MS;
      } else if (user?.id) {
        token.clientId = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      const guestExpired = typeof token.guestUntil === "number" && Date.now() > token.guestUntil;
      if (!guestExpired && token.clientId && typeof token.clientId === "string") {
        session.clientId = token.clientId;
        if (typeof token.guestUntil === "number") session.guest = true;
      }
      if (token.adminId && typeof token.adminId === "string") {
        session.adminId = token.adminId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
