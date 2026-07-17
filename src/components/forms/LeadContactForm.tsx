"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function LeadContactForm({ topic }: { topic: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, ...form }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible d'envoyer votre demande");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Impossible d'envoyer votre demande");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-border-light bg-white p-4 text-[13px] text-foreground">
        Merci ! Votre demande a été envoyée. Nous vous répondrons sous peu.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border-light bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nom">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <Field label="Courriel">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
        </Field>
      </div>
      <Field label="Téléphone (optionnel)">
        <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="Message">
        <textarea
          className="w-full rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-navy"
          rows={4}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          required
        />
      </Field>
      {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}
      <Button type="submit" variant="cta" disabled={status === "submitting"}>
        {status === "submitting" ? "Envoi..." : "Envoyer ma demande"}
      </Button>
    </form>
  );
}
