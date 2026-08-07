import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";
import { CATALOGUE } from "../src/lib/catalogue";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function seedTrailers() {
  for (const item of CATALOGUE) {
    const name = `${item.size}-01`;
    const existing = await prisma.trailer.findFirst({ where: { name } });
    if (existing) continue;

    await prisma.trailer.create({
      data: {
        name,
        size: item.size,
        status: "available",
      },
    });
    console.log(`Seeded trailer ${name}`);
  }
}

// Bootstraps the first /dashboard admin from env vars, so a password never
// has to pass through chat or the repo. No-op if an AdminUser already
// exists, or if the env vars aren't set.
async function seedAdmin() {
  const username = process.env.ADMIN_BOOTSTRAP_USERNAME;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!username || !password) return;

  const existingCount = await prisma.adminUser.count();
  if (existingCount > 0) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({ data: { username, passwordHash } });
  console.log(`Seeded admin user ${username}`);
}

async function main() {
  await seedTrailers();
  await seedAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
