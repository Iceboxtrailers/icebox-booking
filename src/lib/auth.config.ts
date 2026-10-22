import type { NextAuthConfig } from "next-auth";
import { GUEST_SESSION_MS } from "@/lib/constants";

// Edge-safe subset of the Auth.js config (no providers, no Prisma) so
// src/middleware.ts can check for a session without pulling the
// Prisma/better-sqlite3 native driver into the Edge Runtime bundle. The full
// config with the Credentials providers lives in src/lib/auth.ts.
//
// This is the session of the booking pages: a client with an account, or a guest. The console has its own
// session and cookie (src/lib/admin-session.ts), so the two never replace each other.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt: async ({ token, user, account }) => {
      // A token from before the console got its own session: it carries an admin identity, which has no
      // place in this session. Returning null ends it (and clears the cookie).
      if ("adminId" in token) return null;

      if (user?.id && account?.provider === "guest-session") {
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
      return session;
    },
  },
} satisfies NextAuthConfig;
