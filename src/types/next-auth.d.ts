import type { DefaultSession } from "next-auth";

// The booking pages' session: a client with an account, or a guest. (The console has its own, see
// src/lib/admin-session.ts.)
declare module "next-auth" {
  interface Session {
    clientId?: string;
    // true for a booking without an account: no access to the client area
    guest?: boolean;
    user?: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    clientId?: string;
    // epoch ms after which a guest session stops working
    guestUntil?: number;
  }
}
