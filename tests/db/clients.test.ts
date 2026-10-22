import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeClient, prisma, setupDatabase } from "./harness";

setupDatabase();

const isUniqueViolation = (error: unknown) => (error as { code?: string }).code === "P2002";

describe("client e-mail addresses", () => {
  it("belong to one real account at most", async () => {
    await makeClient({ email: "marie@example.test" });
    await assert.rejects(makeClient({ email: "marie@example.test" }), isUniqueViolation);
  });

  it("can be shared by guest records, and by a guest record and an account", async () => {
    await makeClient({ email: "invite@example.test", hasAccount: false });
    await makeClient({ email: "invite@example.test", hasAccount: false });
    await makeClient({ email: "invite@example.test", hasAccount: true });
    assert.equal(await prisma.client.count({ where: { email: "invite@example.test" } }), 3);
  });

  it("are not made unique again by a later migration", async () => {
    // Prisma cannot express a partial index, so a `prisma migrate dev` that "fixes" the difference would drop it
    // and quietly allow two accounts with one address (or make guest bookings fail). The migrations are applied
    // from scratch before these tests run, so such a migration shows up here.
    const rows = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname::text AS indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'clients'`;
    const uniqueOnEmail = rows.filter((row) => /UNIQUE/.test(row.indexdef) && /\(email\)/.test(row.indexdef));
    assert.deepEqual(uniqueOnEmail.map((row) => row.indexname), ["clients_email_account_key"]);
    assert.match(uniqueOnEmail[0].indexdef, /WHERE \("hasAccount" = true\)/);
  });
});
