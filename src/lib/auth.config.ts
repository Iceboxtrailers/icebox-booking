import type { NextAuthConfig } from "next-auth";

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
    jwt: async ({ token, user }) => {
      if (user?.id) token.clientId = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (token.clientId && typeof token.clientId === "string") {
        session.clientId = token.clientId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
