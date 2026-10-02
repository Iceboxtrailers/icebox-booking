"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { BrandMark } from "@/components/BrandMark";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Step = "email" | "login" | "details";

function GuestReservationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("email");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function goToNewReservation() {
    const pickupDate = searchParams.get("pickupDate");
    const returnDate = searchParams.get("returnDate");
    const qs = new URLSearchParams();
    if (pickupDate) qs.set("pickupDate", pickupDate);
    if (returnDate) qs.set("returnDate", returnDate);
    const suffix = qs.toString() ? `?${qs}` : "";
    router.push(`/reservation/new${suffix}`);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(form.email)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Impossible de continuer");
        return;
      }
      setStep(data.exists ? "login" : "details");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signInResult = await signIn("credentials", {
        email: form.email,
        password,
        redirect: false,
      });
      if (signInResult?.error) {
        setError("Mot de passe invalide");
        return;
      }
      goToNewReservation();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // No password field shown to the guest — generate one behind the scenes
      // so a Client row (required by the reservation schema) can still exist.
      // They can set a real password later via "mot de passe oublié" if they
      // ever want to revisit /compte.
      const generatedPassword = crypto.randomUUID();
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, password: generatedPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Impossible de continuer");
        return;
      }
      const signInResult = await signIn("credentials", {
        email: form.email,
        password: generatedPassword,
        redirect: false,
      });
      if (signInResult?.error) {
        setError("Impossible de continuer. Essayez de vous connecter.");
        return;
      }
      goToNewReservation();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <Card className="w-full p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <BrandMark size={32} />
          <div className="font-heading text-lg uppercase tracking-wide">Réserver sans compte</div>
        </div>

        {step === "email" && (
          <>
            <div className="mb-4 text-[13px] text-muted">
              Entrez votre courriel pour commencer — aucun mot de passe requis si c&apos;est votre première
              location.
            </div>
            <form onSubmit={handleEmailSubmit}>
              <Field label="Courriel">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="jean.tremblay@courriel.com"
                  required
                  autoFocus
                />
              </Field>
              {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}
              <Button type="submit" variant="cta" disabled={submitting} className="w-full justify-center">
                {submitting ? "Un instant..." : "Continuer"}
              </Button>
            </form>
          </>
        )}

        {step === "login" && (
          <>
            <div className="mb-4 text-[13px] text-muted">
              Vous avez déjà loué chez IceBox ! Nous avons retrouvé vos informations — entrez votre mot de passe
              pour continuer.
            </div>
            <form onSubmit={handleLoginSubmit}>
              <Field label="Courriel">
                <Input type="email" value={form.email} disabled />
              </Field>
              <Field label="Mot de passe">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}
              <Button type="submit" variant="cta" disabled={submitting} className="w-full justify-center">
                {submitting ? "Connexion..." : "Se connecter et continuer"}
              </Button>
            </form>
            <div className="mt-3 flex justify-between text-[12px]">
              <button type="button" onClick={() => setStep("email")} className="text-muted underline">
                Ce n&apos;est pas moi
              </button>
              <a href="/mot-de-passe-oublie" className="text-navy underline">
                Mot de passe oublié ?
              </a>
            </div>
          </>
        )}

        {step === "details" && (
          <>
            <div className="mb-4 text-[13px] text-muted">
              Première location chez IceBox — complétez vos coordonnées pour continuer.
            </div>
            <form onSubmit={handleDetailsSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prénom">
                  <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Jean" required autoFocus />
                </Field>
                <Field label="Nom">
                  <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Tremblay" required />
                </Field>
              </div>
              <Field label="Courriel">
                <Input type="email" value={form.email} disabled />
              </Field>
              <Field label="Téléphone">
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="418-000-0000" required />
              </Field>
              {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}
              <Button type="submit" variant="cta" disabled={submitting} className="w-full justify-center">
                {submitting ? "Un instant..." : "Continuer ma réservation"}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="mt-3 block text-center text-[12px] text-muted underline"
            >
              Ce n&apos;est pas mon courriel
            </button>
          </>
        )}

        <div className="mt-4 text-center text-[13px] text-muted">
          Déjà un compte ? <a href="/login" className="text-navy underline">Se connecter</a>
        </div>
      </Card>
    </div>
  );
}

export default function GuestReservationPage() {
  return (
    <Suspense>
      <GuestReservationForm />
    </Suspense>
  );
}
