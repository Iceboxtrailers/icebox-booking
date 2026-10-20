import type { Mailer } from "./types";

// Used when no email provider is configured (local development): the full rendered
// email is printed to the server console instead of being sent.
export class ConsoleMailer implements Mailer {
  async send({ to, subject, html, replyTo, attachments }: Parameters<Mailer["send"]>[0]) {
    console.log("[email:dev] ---- message not sent (console transport) ----");
    console.log(
      JSON.stringify(
        {
          from: "reservations@icebox.example",
          to,
          replyTo,
          subject,
          attachments: attachments?.map((attachment) => `${attachment.filename} (${attachment.content.length} octets)`),
          html,
        },
        null,
        2,
      ),
    );
  }
}
