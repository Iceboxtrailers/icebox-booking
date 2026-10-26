// Imported first by ./harness, before @/lib/prisma exists: points the app's database client at a throwaway local
// Postgres, through a small WebSocket proxy in this process (see ws-proxy.ts). The app code under test is the real
// code, unchanged.
import { neonConfig } from "@neondatabase/serverless";
import { testDatabaseTarget } from "./target";
import { startWsProxy } from "./ws-proxy";

const target = testDatabaseTarget();

// @/lib/prisma reads this when it loads.
process.env.DATABASE_URL = target.url;
process.env.AUTH_SECRET ??= "database-tests-secret";

const proxy = startWsProxy({ target });

export const ready = proxy.ready;
export const stopProxy = proxy.stop;

neonConfig.useSecureWebSocket = false;
neonConfig.pipelineTLS = false;
neonConfig.pipelineConnect = false;
neonConfig.wsProxy = () => `127.0.0.1:${proxy.port()}/v1`;
