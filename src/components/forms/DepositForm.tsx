"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY!);
  return stripePromise;
}

async function confirmOnServer(reservationId: string, setupIntentId: string) {
  const res = await fetch(`/api/deposits/${reservationId}/card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setupIntentId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Impossible d'enregistrer la carte");
  }
}

function CardForm({ reservationId, onSaved }: { reservationId: string; onSaved: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/reservation/${reservationId}/depot`,
        },
      });
      if (confirmError) {
        setError(confirmError.message ?? "La carte a été refusée");
        return;
      }
      if (!setupIntent || setupIntent.status !== "succeeded") {
        setError("La carte n'a pas pu être enregistrée");
        return;
      }
      await confirmOnServer(reservationId, setupIntent.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer la carte");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3.5 rounded-lg border border-border-light bg-[#FAFBFB] p-4">
        <PaymentElement />
      </div>
      {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}
      <Button type="submit" variant="cta" disabled={!stripe || submitting}>
        {submitting ? "..." : "Enregistrer ma carte"}
      </Button>
    </form>
  );
}

export function DepositForm({
  reservationId,
  initiallySaved,
}: {
  reservationId: string;
  initiallySaved: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saved, setSaved] = useState(initiallySaved);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const depositDisplay = (DEPOSIT_AMOUNT_CENTS / 100).toLocaleString("fr-CA", { maximumFractionDigits: 0 });

  // Stripe may redirect some flows (certain 3-D Secure challenges) back to this
  // page instead of resolving confirmSetup() in place — pick the result up from
  // the return URL in that case.
  useEffect(() => {
    if (saved) return;
    const redirectedSetupId = searchParams.get("setup_intent");
    const redirectStatus = searchParams.get("redirect_status");
    if (redirectedSetupId && redirectStatus === "succeeded") {
      confirmOnServer(reservationId, redirectedSetupId)
        .then(() => setSaved(true))
        .catch((err) => setError(err instanceof Error ? err.message : "Impossible d'enregistrer la carte"));
    }
  }, [saved, reservationId, searchParams]);

  const setupRequested = useRef(false);
  useEffect(() => {
    if (saved || setupRequested.current || !PUBLISHABLE_KEY) return;
    setupRequested.current = true;
    (async () => {
      const res = await fetch(`/api/deposits/${reservationId}/setup`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible de préparer le paiement");
        return;
      }
      const data = await res.json();
      setClientSecret(data.clientSecret);
    })();
  }, [saved, reservationId]);

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 text-[13px] text-muted">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <span>
          Enregistrez votre carte maintenant : rien n&apos;est débité. Un dépôt de sécurité de {depositDisplay} $ sera
          retenu sur cette carte juste avant la remise de la remorque, puis libéré après son retour conforme aux
          conditions de location.
        </span>
      </div>

      {!saved &&
        (!PUBLISHABLE_KEY ? (
          <div className="mb-3.5 rounded-lg border border-border-light bg-[#FAFBFB] p-4 text-[13px] text-muted">
            Le paiement en ligne n&apos;est pas encore configuré. Communiquez avec IceBox pour finaliser votre
            réservation.
          </div>
        ) : clientSecret ? (
          <Elements stripe={getStripe()} options={{ clientSecret }}>
            <CardForm reservationId={reservationId} onSaved={() => setSaved(true)} />
          </Elements>
        ) : (
          <div className="mb-3.5 text-[13px] text-muted">Chargement du paiement...</div>
        ))}

      {saved && (
        <div className="mb-3.5 rounded-lg border border-border-light bg-[#FAFBFB] p-4 text-[13px] text-foreground">
          Carte enregistrée. Aucun montant n&apos;a été débité.
        </div>
      )}

      {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}

      <div className="mt-4 flex justify-between">
        <Button type="button" onClick={() => router.back()}>
          Précédent
        </Button>
        <Button
          type="button"
          variant="cta"
          disabled={!saved}
          onClick={() => router.push(`/reservation/${reservationId}/confirmation`)}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}
