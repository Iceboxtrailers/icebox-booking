// `npx tsx tests/db/serve.ts`: lets the app itself run against the local test database (for trying a screen without
// touching the real data, which .env.local points to). Leave it running, and in another terminal start the app with
// the two variables it prints.
import { testDatabaseTarget } from "./target";
import { startWsProxy } from "./ws-proxy";

const target = testDatabaseTarget();
const proxy = startWsProxy({ target, listenPort: Number(process.env.WS_PROXY_PORT) || 54330 });

proxy.ready.then(() => {
  console.log("Proxy ready. Start the app with:");
  console.log(`  DATABASE_URL=${target.url} NEON_LOCAL_WS_PROXY=127.0.0.1:${proxy.port()}/v1 npm run dev`);
  console.log("(and empty STRIPE_SECRET_KEY, RESEND_API_KEY, BLOB_READ_WRITE_TOKEN, QUICKBOOKS_CLIENT_ID/SECRET so nothing real is reached)");
});
