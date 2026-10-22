// Imported first by ./harness, before @/lib/prisma exists: points the app's database client at a
// throwaway local Postgres. The app talks to Neon over WebSockets, which a plain Postgres does not
// speak, so a small proxy in this process turns each WebSocket back into a TCP connection (what Neon's
// own `wsproxy` does). The app code under test is the real code, unchanged.
import net from "node:net";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";
import type { RawData } from "ws";
import { neonConfig } from "@neondatabase/serverless";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

const raw = process.env.TEST_DATABASE_URL;
if (!raw) {
  throw new Error("TEST_DATABASE_URL is not set. Run the database tests with `npm run test:db` (see tests/db/README.md).");
}
const target = new URL(raw);
if (!LOCAL_HOSTS.includes(target.hostname)) {
  throw new Error(`TEST_DATABASE_URL must point at a local database, not "${target.hostname}": the tests wipe their tables.`);
}

// @/lib/prisma reads this when it loads.
process.env.DATABASE_URL = raw;
process.env.AUTH_SECRET ??= "database-tests-secret";

const upstreamHost = target.hostname === "localhost" ? "127.0.0.1" : target.hostname.replace(/^\[|\]$/g, "");
const upstreamPort = Number(target.port) || 5432;

const proxy = new WebSocketServer({ host: "127.0.0.1", port: 0 });

export const ready = new Promise<void>((resolve, reject) => {
  proxy.once("listening", () => resolve());
  proxy.once("error", reject);
});

const asBuffer = (data: RawData): Buffer => (Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as Buffer));

proxy.on("connection", (client) => {
  const upstream = net.connect({ host: upstreamHost, port: upstreamPort });
  upstream.setNoDelay(true);
  client.on("message", (data) => upstream.write(asBuffer(data)));
  upstream.on("data", (chunk) => client.send(chunk));
  const close = () => {
    client.terminate();
    upstream.destroy();
  };
  client.on("close", close);
  client.on("error", close);
  upstream.on("close", close);
  upstream.on("error", close);
});

neonConfig.useSecureWebSocket = false;
neonConfig.pipelineTLS = false;
neonConfig.pipelineConnect = false;
neonConfig.wsProxy = () => `127.0.0.1:${(proxy.address() as AddressInfo).port}/v1`;

export async function stopProxy(): Promise<void> {
  for (const client of proxy.clients) client.terminate();
  await new Promise<void>((resolve) => proxy.close(() => resolve()));
}
