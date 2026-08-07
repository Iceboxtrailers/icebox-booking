"use client";

import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setStatus("sent");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <Card className="w-full p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <BrandMark size={32} />
          <div className="font-heading text-lg uppercase tracking-wide">Mot de passe oublié</div>
        </div>

        {status === "sent" ? (
          <div className="text-[13px] text-foreground">
            Si un compte existe avec cette adresse, un courriel de réinitialisation vient d&apos;être envoyé.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4 text-[13px] text-muted">
              Entrez votre adresse courriel pour recevoir un lien de réinitialisation.
            </div>
            <Field label="Courriel">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Button
              type="submit"
              variant="cta"
              disabled={status === "submitting"}
              className="w-full justify-center"
            >
              {status === "submitting" ? "Envoi..." : "Envoyer le lien"}
            </Button>
          </form>
        )}

        <div className="mt-4 text-center text-[13px] text-muted">
          <a href="/login" className="text-navy underline">
            Retour à la connexion
          </a>
        </div>
      </Card>
    </div>
  );
}
