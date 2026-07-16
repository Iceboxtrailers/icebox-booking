"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";

export function DepositForm({
  reservationId,
  initiallyAuthorized,
}: {
  reservationId: string;
  initiallyAuthorized: boolean;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(initiallyAuthorized);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const depositDisplay = (DEPOSIT_AMOUNT_CENTS / 100).toFixed(0);

  async function handleAuthorize() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/deposits/${reservationId}/authorize`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible d'autoriser le dépôt");
        return;
      }
      setAuthorized(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-[13px] text-muted">
        <ShieldCheck size={16} /> Un dépôt de sécurité de {depositDisplay} $ sera autorisé (non débité) sur votre
        carte.
      </div>

      <div className="mb-3.5 rounded-lg border border-border-light bg-[#FAFBFB] p-4">
        <div className="mb-2.5 text-[11px] text-muted">
          Démonstration seulement — aucun champ ci-dessous n&apos;est réel ni transmis. Sur le site final, ce
          formulaire serait remplacé par un module de paiement certifié (ex. Stripe).
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Numéro de carte (démo)">
            <Input className="font-mono" placeholder="•••• •••• •••• ••••" disabled />
          </Field>
          <Field label="Expiration (démo)">
            <Input className="font-mono" placeholder="MM/AA" disabled />
          </Field>
        </div>
      </div>

      <Button type="button" variant="cta" onClick={handleAuthorize} disabled={authorized || submitting}>
        <CreditCard size={14} /> {authorized ? "Dépôt autorisé (simulation)" : submitting ? "..." : "Simuler l'autorisation du dépôt"}
      </Button>

      {error && <div className="mt-3 text-[13px] text-red-600">{error}</div>}

      <div className="mt-4 flex justify-between">
        <Button type="button" onClick={() => router.back()}>
          Précédent
        </Button>
        <Button
          type="button"
          variant="cta"
          disabled={!authorized}
          onClick={() => router.push(`/reservation/${reservationId}/confirmation`)}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}
