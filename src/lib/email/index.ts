import { ConsoleMailer } from "./console";
import { ResendMailer } from "./resend";
import type { Mailer } from "./types";

export type { Mailer };

let instance: Mailer | null = null;

// Real delivery once RESEND_API_KEY is set; otherwise the message is only printed
// to the server log (local development, or production before the key exists).
export function getMailer(): Mailer {
  if (!instance) {
    instance = process.env.RESEND_API_KEY ? new ResendMailer() : new ConsoleMailer();
  }
  return instance;
}

export function emailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

const INTERNAL_INBOX = "info@iceboxtrailers.ca";

// The shared inbox plus any addresses listed in INTERNAL_NOTICE_COPY_TO (comma
// separated), e.g. a second mailbox that is not subject to the own-domain spam filter.
export function internalRecipients(): string[] {
  const extra = (process.env.INTERNAL_NOTICE_COPY_TO ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter((address) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address));
  return [INTERNAL_INBOX, ...extra.filter((address) => address.toLowerCase() !== INTERNAL_INBOX)];
}

// Sends the same notice to every internal recipient; it only fails when none got it.
export async function sendInternalNotice(p: {
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  const mailer = getMailer();
  const results = await Promise.allSettled(internalRecipients().map((to) => mailer.send({ to, ...p })));
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  failures.forEach((f) => console.error("Internal notice failed for one recipient", f.reason));
  if (failures.length === results.length) throw failures[0].reason;
}
