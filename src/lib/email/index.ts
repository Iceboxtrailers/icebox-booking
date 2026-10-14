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
