import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { authConfig } from "@/lib/auth.config";

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

        const client = await prisma.client.findUnique({
          where: { email: parsed.data.email },
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
  ],
});
