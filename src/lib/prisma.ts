import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Neon's serverless driver talks over WebSockets; outside the edge runtime
// (plain Node.js, e.g. local dev or Vercel's Node functions) it needs a
// WebSocket implementation supplied explicitly.
neonConfig.webSocketConstructor = ws;

// Trying the app on a plain local Postgres (see tests/db/README.md): the driver goes through a small
// WebSocket-to-TCP proxy instead of Neon's endpoint. Never set on Vercel, and ignored there anyway.
if (process.env.NEON_LOCAL_WS_PROXY && !process.env.VERCEL) {
  const proxy = process.env.NEON_LOCAL_WS_PROXY;
  neonConfig.wsProxy = () => proxy;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
