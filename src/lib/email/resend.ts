import type { Mailer } from "./types";

export const DEFAULT_FROM = "IceBox <info@iceboxtrailers.ca>";

// Sends through Resend's HTTP API (no SDK). The "from" address must belong to a
// domain verified in Resend; replies go to the real business mailbox.
export class ResendMailer implements Mailer {
  async send({
    to,
    subject,
    html,
    replyTo,
    attachments,
  }: Parameters<Mailer["send"]>[0]): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("RESEND_API_KEY n'est pas configuré");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
        to: [to],
        subject,
        html,
        reply_to: replyTo ?? "info@iceboxtrailers.ca",
        ...(attachments?.length
          ? {
              attachments: attachments.map((a) => ({
                filename: a.filename,
                content: a.content.toString("base64"),
                ...(a.contentType ? { content_type: a.contentType } : {}),
              })),
            }
          : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
  }
}
