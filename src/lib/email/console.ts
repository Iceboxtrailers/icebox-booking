import nodemailer from "nodemailer";
import type { Mailer } from "./types";

// No SMTP account exists yet, so the full rendered email is printed to the
// dev server console via Nodemailer's JSON transport. Swap for a real
// transport (e.g. SMTP, Resend, SES) behind the same interface later.
export class ConsoleMailer implements Mailer {
  private transport = nodemailer.createTransport({ jsonTransport: true });

  async send({ to, subject, html }: { to: string; subject: string; html: string }) {
    const info = await this.transport.sendMail({
      from: "reservations@icebox.example",
      to,
      subject,
      html,
    });
    console.log("[email:dev] ---- message sent (console transport) ----");
    console.log(info.message.toString());
  }
}
