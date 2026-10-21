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
  const [sendingLink, setSendingLink] = useState(false);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // For the owner of a real account who has no password at hand: proving the email is theirs
  // (a link sent to it) is the safe way in. Guests never come through here, they have no account.
  async function handleSendLink() {
    setError(null);
    setSendingLink(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      if (!res.ok) {
        setError("Impossible d'envoyer le courriel pour le moment. Réessayez dans un instant.");
        return;
      }
      setLinkNotice(
        `Un courriel vient d'être envoyé à ${form.email}. Ouvrez le lien qu'il contient pour choisir un mot de passe, puis revenez vous connecter ici. Si rien n'arrive dans quelques minutes, vérifiez vos courriels indésirables ou appelez-nous au 581 889-2093.`,
      );
    } finally {
      setSendingLink(false);
    }
  }

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
      // No account is created: the server keeps these details for this booking only (visible to
      // IceBox staff) and gives back a one-time token for a short session limited to this booking.
      const res = await fetch("/api/guest/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.code === "account_exists") {
        setStep("login");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Impossible de continuer");
        return;
      }
      const signInResult = await signIn("guest-session", { token: data.token, redirect: false });
      if (signInResult?.error) {
        setError("Impossible de continuer. Veuillez réessayer.");
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
              Entrez votre courriel pour commencer. Aucun compte ni mot de passe n&apos;est nécessaire pour
              réserver.
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
              Un compte existe déjà avec ce courriel. Entrez votre mot de passe pour continuer, ou recevez un lien
              par courriel pour en choisir un.
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
            {linkNotice ? (
              <div className="mt-4 rounded-md border border-border-light bg-subtle p-3 text-[13px]">{linkNotice}</div>
            ) : (
              <div className="mt-4 border-t border-border-light pt-3 text-[13px] text-muted">
                Pas de mot de passe, ou vous l&apos;avez oublié ?{" "}
                <button
                  type="button"
                  onClick={handleSendLink}
                  disabled={sendingLink}
                  className="text-navy underline disabled:opacity-60"
                >
                  {sendingLink ? "Envoi..." : "Recevoir un lien par courriel"}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setLinkNotice(null);
                setError(null);
                setStep("email");
              }}
              className="mt-3 text-[12px] text-muted underline"
            >
              Ce n&apos;est pas moi
            </button>
          </>
        )}

        {step === "details" && (
          <>
            <div className="mb-4 text-[13px] text-muted">
              Complétez vos coordonnées pour continuer. Aucun compte n&apos;est créé : votre réservation est
              enregistrée seulement dans notre système, et vous recevez votre contrat par courriel.
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
          Déjà un compte ? <a href="/login" className="inline-block py-1.5 text-navy underline">Se connecter</a>
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
