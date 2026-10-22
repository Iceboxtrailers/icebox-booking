// Shared setup of the database tests. Every test file imports this FIRST (before any @/lib module): it
// connects the app to the test database, replaces the network with a fake mail service, and builds
// the rows the tests need.
import { after, before, beforeEach } from "node:test";
import { ready, stopProxy } from "./env";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export { prisma };

// ---- fake mail service -------------------------------------------------------------------------------
// The app sends mail through Resend's HTTP API. Here that call is answered by this file: nothing leaves the
// machine, and a test can make the service refuse a message.

export type Mail = { to: string; subject: string; html: string; attachments: { filename: string }[]; ok: boolean };

const attempts: Mail[] = [];
const ACCEPT = { status: 200, text: '{"id":"fake"}' };
let outcome = ACCEPT;

process.env.RESEND_API_KEY = "re_database_tests";
delete process.env.INTERNAL_NOTICE_COPY_TO;
delete process.env.EMAIL_FROM;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url !== "https://api.resend.com/emails") throw new Error(`A database test must not reach the network: ${url}`);
  const body = JSON.parse(String(init?.body)) as { to: string[]; subject: string; html: string; attachments?: { filename: string }[] };
  attempts.push({ to: body.to[0], subject: body.subject, html: body.html, attachments: body.attachments ?? [], ok: outcome.status < 400 });
  return new Response(outcome.text, { status: outcome.status });
}) as typeof fetch;

export const mail = {
  /** the messages the service accepted */
  delivered: () => attempts.filter((m) => m.ok),
  /** the accepted messages addressed to one person */
  to: (address: string) => attempts.filter((m) => m.ok && m.to === address),
  /** everything the app asked it to send, accepted or not */
  attempts: () => [...attempts],
  /** from now on the service answers every message with this error */
  rejectWith: (status: number, text: string) => {
    outcome = { status, text };
  },
  reset: () => {
    attempts.length = 0;
    outcome = ACCEPT;
  },
};

// ---- database ----------------------------------------------------------------------------------------

// The tests empty the tables they use. Together with the local-host check in ./env this keeps them away
// from anything real: the database must say, by its own name, that it is a test database.
const MAY_BE_WIPED = /test|^ci$/i;

export async function resetDatabase(): Promise<void> {
  const [{ name }] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database()::text AS name`;
  if (!MAY_BE_WIPED.test(name)) {
    throw new Error(`Refusing to empty the database "${name}": the name of a test database contains "test" (or is "ci").`);
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename::text AS tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) throw new Error("The test database has no tables: apply the migrations first (`npm run test:db` does).");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

/** The hooks every database test file needs: empty tables before each test, and a clean exit at the end. */
export function setupDatabase(): void {
  before(async () => {
    await ready;
  });
  beforeEach(async () => {
    await resetDatabase();
    mail.reset();
  });
  after(async () => {
    await prisma.$disconnect();
    await stopProxy();
  });
}

// ---- rows --------------------------------------------------------------------------------------------

/** A date column value (stored as midnight UTC) from "YYYY-MM-DD". */
export const at = (day: string) => new Date(`${day}T00:00:00Z`);

let sequence = 0;
const next = () => ++sequence;

export function makeClient(over: Partial<Prisma.ClientUncheckedCreateInput> = {}) {
  const n = next();
  return prisma.client.create({
    data: {
      firstName: "Marie",
      lastName: `Tremblay-${n}`,
      email: `client${n}@example.test`,
      phone: "418 555 0100",
      passwordHash: "not-a-real-hash",
      ...over,
    },
  });
}

export function makeTrailer(over: Partial<Prisma.TrailerUncheckedCreateInput> = {}) {
  const n = next();
  return prisma.trailer.create({ data: { name: `5x10-${n}`, size: "5x10", ...over } });
}

export type BookingOptions = {
  client?: { id: string };
  /** `null`: a booking that has not chosen a trailer yet */
  trailer?: { id: string } | null;
  start?: string;
  end?: string;
  status?: string;
  /** the contract is signed (default) */
  signed?: boolean;
  /** a card is saved for the deposit (default) */
  card?: boolean;
  pdfUrl?: string | null;
  over?: Partial<Prisma.ReservationUncheckedCreateInput>;
};

/** By default a booking that is ready to be confirmed: signed contract, card on file. */
export async function makeBooking(o: BookingOptions = {}) {
  const client = o.client ?? (await makeClient());
  const signed = o.signed ?? true;
  const card = o.card ?? true;
  return prisma.reservation.create({
    data: {
      clientId: client.id,
      trailerId: o.trailer === null ? null : o.trailer?.id,
      pickupDate: o.start ? at(o.start) : undefined,
      returnDate: o.end ? at(o.end) : undefined,
      status: o.status ?? "pending",
      totalAmount: 45000,
      depositStatus: card ? "card_on_file" : "none",
      stripePaymentMethodId: card ? "pm_test" : null,
      ...(signed
        ? { contract: { create: { signatureStatus: "signed", signedAt: new Date(), signerName: "Marie Tremblay", pdfUrl: o.pdfUrl ?? null } } }
        : {}),
      ...o.over,
    },
    include: { client: true, trailer: true, contract: true },
  });
}
