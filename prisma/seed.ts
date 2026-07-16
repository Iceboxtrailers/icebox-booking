import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { CATALOGUE } from "../src/lib/catalogue";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const item of CATALOGUE) {
    const name = `${item.model}-01`;
    const existing = await prisma.trailer.findFirst({ where: { name } });
    if (existing) continue;

    await prisma.trailer.create({
      data: {
        name,
        model: item.model,
        type: item.type,
        size: item.size,
        dailyRate: item.dailyRateCents,
        status: "available",
      },
    });
    console.log(`Seeded trailer ${name}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
