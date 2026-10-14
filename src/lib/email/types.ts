export type EmailAttachment = { filename: string; content: Buffer; contentType?: string };

export interface Mailer {
  send(p: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
    attachments?: EmailAttachment[];
  }): Promise<void>;
}
