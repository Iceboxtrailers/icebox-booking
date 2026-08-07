"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible de réinitialiser le mot de passe");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <Card className="w-full p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <BrandMark size={32} />
          <div className="font-heading text-lg uppercase tracking-wide">Nouveau mot de passe</div>
        </div>

        {done ? (
          <div className="text-[13px] text-foreground">
            Votre mot de passe a été réinitialisé. Redirection vers la connexion...
          </div>
        ) : !token ? (
          <div className="text-[13px] text-red-600">
            Ce lien de réinitialisation est invalide. Demandez-en un nouveau depuis la page{" "}
            <a href="/mot-de-passe-oublie" className="text-navy underline">
              mot de passe oublié
            </a>
            .
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Field label="Nouveau mot de passe">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                minLength={8}
                required
              />
            </Field>
            {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}
            <Button type="submit" variant="cta" disabled={submitting} className="w-full justify-center">
              {submitting ? "..." : "Réinitialiser le mot de passe"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
