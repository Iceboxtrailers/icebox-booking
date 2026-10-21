"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { BrandMark } from "@/components/BrandMark";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { safeRedirectPath } from "@/lib/safe-redirect";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeRedirectPath(searchParams.get("callbackUrl"), "/dashboard");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Step one: password. The server says whether an authenticator code is also needed.
      if (!needsCode) {
        const res = await fetch("/api/admin/auth/precheck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Nom d'utilisateur ou mot de passe invalide");
          return;
        }
        if (data.mfaRequired) {
          setNeedsCode(true);
          return;
        }
      }

      const result = await signIn("admin-credentials", {
        username,
        password,
        code: needsCode ? code : "",
        redirect: false,
      });
      if (result?.error) {
        setError(needsCode ? "Code invalide ou déjà utilisé" : "Nom d'utilisateur ou mot de passe invalide");
        return;
      }
      router.push(callbackUrl);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <Card className="w-full p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <BrandMark size={32} />
          <h1 className="font-heading text-lg uppercase tracking-wide">Console Admin</h1>
        </div>
        <form onSubmit={handleSubmit}>
          {!needsCode ? (
            <>
              <Field label="Nom d'utilisateur">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
              </Field>
              <Field label="Mot de passe">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </Field>
            </>
          ) : (
            <>
              <p className="mb-3 text-[13px] text-muted">
                Entrez le code à 6 chiffres affiché dans votre application d&apos;authentification (ou un code de
                récupération).
              </p>
              <Field label="Code de vérification">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                />
              </Field>
            </>
          )}
          {error && <div role="alert" className="mb-3 text-[13px] text-red-600">{error}</div>}
          <Button type="submit" variant="cta" disabled={submitting} className="w-full justify-center">
            {submitting ? "Connexion..." : needsCode ? "Vérifier" : "Se connecter"}
          </Button>
          {needsCode && (
            <button
              type="button"
              onClick={() => {
                setNeedsCode(false);
                setCode("");
                setError(null);
              }}
              className="mt-3 w-full text-center text-[12px] text-muted hover:underline"
            >
              Retour
            </button>
          )}
        </form>
      </Card>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
