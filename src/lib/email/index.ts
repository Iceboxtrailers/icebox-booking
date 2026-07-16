import { ConsoleMailer } from "./console";
import type { Mailer } from "./types";

export type { Mailer };

let instance: Mailer | null = null;

export function getMailer(): Mailer {
  if (!instance) {
    instance = new ConsoleMailer();
  }
  return instance;
}
