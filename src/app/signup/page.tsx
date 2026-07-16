"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { User } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Impossible de créer le compte");
        return;
      }
      const signInResult = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (signInResult?.error) {
        setError("Compte créé, mais la connexion a échoué. Essayez de vous connecter.");
        return;
      }
      router.push("/reservation/new");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <Card className="w-full p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <BrandMark size={32} />
          <div className="font-heading text-lg uppercase tracking-wide">Créer un compte</div>
        </div>
        <div className="mb-4 flex items-center gap-2 text-[13px] text-muted">
          <User size={16} /> Créez votre compte pour réserver et suivre l&apos;historique de vos locations.
        </div>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Jean" required />
            </Field>
            <Field label="Nom">
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Tremblay" required />
            </Field>
          </div>
          <Field label="Courriel">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="jean.tremblay@courriel.com"
              required
            />
          </Field>
          <Field label="Téléphone">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="418-000-0000" required />
          </Field>
          <Field label="Mot de passe">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="8 caractères minimum"
              required
              minLength={8}
            />
          </Field>
          {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}
          <Button type="submit" variant="cta" disabled={submitting} className="w-full justify-center">
            {submitting ? "Création..." : "Créer mon compte"}
          </Button>
        </form>
        <div className="mt-4 text-center text-[13px] text-muted">
          Déjà un compte ? <a href="/login" className="text-navy underline">Se connecter</a>
        </div>
      </Card>
    </div>
  );
}
