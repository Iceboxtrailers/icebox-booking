// `npm run test:db`: applies the migrations to a local test database, then runs the database tests
// (tests/db) against it. Needs a Postgres of your own: see tests/db/README.md.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL is not set. Example: postgresql://user:password@localhost:5432/icebox_test (see tests/db/README.md).");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error("TEST_DATABASE_URL is not a valid connection string.");
  process.exit(1);
}
if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
  console.error(`TEST_DATABASE_URL must point at a local database, not "${parsed.hostname}": the tests empty their tables.`);
  process.exit(1);
}
const database = decodeURIComponent(parsed.pathname.slice(1));
if (!/test|^ci$/i.test(database)) {
  console.error(`The test database must have "test" in its name (or be called "ci"); "${database}" does not.`);
  process.exit(1);
}

// Prisma and the app both read DATABASE_URL: it is set to the test database for these two commands only.
const env = { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" };

// The command-line tools are started with this same node, whatever the operating system.
const require = createRequire(import.meta.url);
function binOf(packageName) {
  const manifestPath = require.resolve(`${packageName}/package.json`);
  const { bin } = JSON.parse(readFileSync(manifestPath, "utf8"));
  return join(dirname(manifestPath), typeof bin === "string" ? bin : bin[packageName]);
}

function run(label, tool, args) {
  console.log(`\n> ${label}`);
  const result = spawnSync(process.execPath, [binOf(tool), ...args], { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("prisma migrate deploy", "prisma", ["migrate", "deploy"]);
run("database tests", "tsx", ["--test", "--test-concurrency=1", "tests/db/**/*.test.ts"]);
