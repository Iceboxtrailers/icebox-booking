import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    clientId?: string;
    // true for a booking without an account: no access to the client area
    guest?: boolean;
    adminId?: string;
    user?: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    clientId?: string;
    adminId?: string;
    // epoch ms after which a guest session stops working
    guestUntil?: number;
  }
}
