export interface Mailer {
  send(p: { to: string; subject: string; html: string }): Promise<void>;
}
