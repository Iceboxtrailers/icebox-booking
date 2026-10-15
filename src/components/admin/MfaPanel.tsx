"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function MfaPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(url: string, body?: unknown) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue");
        return null;
      }
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function startSetup() {
    const data = await call("/api/admin/mfa/setup");
    if (data) setSetup(data);
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    const data = await call("/api/admin/mfa/enable", { code });
    if (data) {
      setRecoveryCodes(data.recoveryCodes);
      setSetup(null);
      setCode("");
    }
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    const data = await call("/api/admin/mfa/disable", { code });
    if (data) {
      setDisabling(false);
      setCode("");
      router.refresh();
    }
  }

  if (recoveryCodes) {
    return (
      <Card className="max-w-md p-4 text-[13px]">
        <div className="mb-1 font-medium">Double authentification activée</div>
        <p className="mb-3 text-muted">
          Conservez ces codes de récupération dans un endroit sûr (gestionnaire de mots de passe, coffre). Chacun
          fonctionne <strong>une seule fois</strong> si vous perdez votre téléphone. Ils ne seront plus jamais
          affichés.
        </p>
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-md border border-border-light bg-subtle p-3 font-mono text-[13px]">
          {recoveryCodes.map((c) => (
            <div key={c}>{c}</div>
          ))}
        </div>
        <Button
          type="button"
          variant="cta"
          onClick={() => {
            setRecoveryCodes(null);
            router.refresh();
          }}
        >
          J&apos;ai conservé mes codes
        </Button>
      </Card>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      <Card className="p-4 text-[13px]">
        <div className="mb-1 font-medium">Double authentification (2FA)</div>
        <div className={enabled ? "text-green-700" : "text-muted"}>
          {enabled
            ? "Activée : un code de votre téléphone est demandé à chaque connexion."
            : "Non activée : seul le mot de passe protège ce compte."}
        </div>
        {!enabled && !setup && (
          <Button type="button" variant="cta" onClick={startSetup} disabled={busy} className="mt-3">
            Activer la double authentification
          </Button>
        )}
        {enabled && !disabling && (
          <button type="button" onClick={() => setDisabling(true)} className="mt-3 text-[12px] text-red-600 hover:underline">
            Désactiver
          </button>
        )}
      </Card>

      {setup && (
        <Card className="p-4 text-[13px]">
          <ol className="mb-3 list-decimal space-y-1 pl-4 text-muted">
            <li>Installez une application d&apos;authentification (Google Authenticator, Microsoft Authenticator…).</li>
            <li>Scannez ce code QR (ou saisissez la clé à la main).</li>
            <li>Entrez le code à 6 chiffres qui s&apos;affiche pour confirmer.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="Code QR de la double authentification" className="mb-2 h-[220px] w-[220px]" />
          <div className="mb-3 break-all font-mono text-[12px] text-muted">Clé : {setup.secret}</div>
          <form onSubmit={confirmSetup}>
            <Field label="Code à 6 chiffres">
              <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required />
            </Field>
            <Button type="submit" variant="cta" disabled={busy}>
              {busy ? "..." : "Confirmer et activer"}
            </Button>
          </form>
        </Card>
      )}

      {disabling && (
        <Card className="p-4 text-[13px]">
          <p className="mb-3 text-muted">Entrez un code de votre application (ou un code de récupération) pour désactiver.</p>
          <form onSubmit={confirmDisable}>
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" required />
            </Field>
            <div className="flex gap-3">
              <Button type="submit" variant="cta" disabled={busy}>
                {busy ? "..." : "Désactiver"}
              </Button>
              <Button type="button" onClick={() => setDisabling(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && <div className="text-[13px] text-red-600">{error}</div>}
    </div>
  );
}
