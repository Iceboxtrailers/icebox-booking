import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    clientId?: string;
    adminId?: string;
    user?: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    clientId?: string;
    adminId?: string;
  }
}
