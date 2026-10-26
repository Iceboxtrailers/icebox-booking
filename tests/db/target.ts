const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

// The database the tests (and `serve.ts`) may use: named in TEST_DATABASE_URL and on this machine. The tests empty
// their tables, so anything else is refused here, before a connection is even tried.
export function testDatabaseTarget(): { url: string; host: string; port: number } {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set. Run the database tests with `npm run test:db` (see tests/db/README.md).");
  }
  const parsed = new URL(url);
  if (!LOCAL_HOSTS.includes(parsed.hostname)) {
    throw new Error(`TEST_DATABASE_URL must point at a local database, not "${parsed.hostname}": the tests wipe their tables.`);
  }
  return {
    url,
    // "localhost" can resolve to ::1 first while Postgres listens on 127.0.0.1 only.
    host: parsed.hostname === "localhost" ? "127.0.0.1" : parsed.hostname.replace(/^\[|\]$/g, ""),
    port: Number(parsed.port) || 5432,
  };
}
