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

async function confirmOnServer(reservationId: string, transactionId: string) {
  const res = await fetch(`/api/deposits/${reservationId}/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Impossible d'autoriser le dépôt");
  }
}

function CheckoutForm({
  reservationId,
  onAuthorized,
}: {
  reservationId: string;
  onAuthorized: () => void;
}) {
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
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/reservation/${reservationId}/depot`,
        },
      });
      if (confirmError) {
        setError(confirmError.message ?? "Le paiement a été refusé");
        return;
      }
      if (!paymentIntent || paymentIntent.status !== "requires_capture") {
        setError("Le dépôt n'a pas pu être autorisé");
        return;
      }
      await confirmOnServer(reservationId, paymentIntent.id);
      onAuthorized();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'autoriser le dépôt");
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
        {submitting ? "..." : "Autoriser le dépôt"}
      </Button>
    </form>
  );
}

export function DepositForm({
  reservationId,
  initiallyAuthorized,
}: {
  reservationId: string;
  initiallyAuthorized: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authorized, setAuthorized] = useState(initiallyAuthorized);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const depositDisplay = (DEPOSIT_AMOUNT_CENTS / 100).toFixed(0);

  // Stripe redirects some payment methods (bank debits, certain 3-D Secure
  // flows) back to this same page instead of resolving confirmPayment()
  // in-place — pick the confirmation up from the return URL in that case.
  useEffect(() => {
    if (authorized) return;
    const redirectedIntentId = searchParams.get("payment_intent");
    const redirectStatus = searchParams.get("redirect_status");
    if (redirectedIntentId && redirectStatus === "succeeded") {
      confirmOnServer(reservationId, redirectedIntentId)
        .then(() => setAuthorized(true))
        .catch((err) => setError(err instanceof Error ? err.message : "Impossible d'autoriser le dépôt"));
    }
  }, [authorized, reservationId, searchParams]);

  const intentRequested = useRef(false);
  useEffect(() => {
    if (authorized || intentRequested.current || !PUBLISHABLE_KEY) return;
    intentRequested.current = true;
    (async () => {
      const res = await fetch(`/api/deposits/${reservationId}/intent`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible de préparer le paiement");
        return;
      }
      const data = await res.json();
      setClientSecret(data.clientSecret);
    })();
  }, [authorized, reservationId]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-[13px] text-muted">
        <ShieldCheck size={16} /> Un dépôt de sécurité de {depositDisplay} $ sera autorisé (non débité) sur votre
        carte, et remis après le retour de la remorque conformément aux conditions de location.
      </div>

      {!authorized &&
        (!PUBLISHABLE_KEY ? (
          <div className="mb-3.5 rounded-lg border border-border-light bg-[#FAFBFB] p-4 text-[13px] text-muted">
            Le paiement en ligne n&apos;est pas encore configuré. Communiquez avec IceBox pour finaliser votre
            réservation.
          </div>
        ) : clientSecret ? (
          <Elements stripe={getStripe()} options={{ clientSecret }}>
            <CheckoutForm reservationId={reservationId} onAuthorized={() => setAuthorized(true)} />
          </Elements>
        ) : (
          <div className="mb-3.5 text-[13px] text-muted">Chargement du paiement...</div>
        ))}

      {authorized && (
        <div className="mb-3.5 rounded-lg border border-border-light bg-[#FAFBFB] p-4 text-[13px] text-foreground">
          Dépôt autorisé.
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
          disabled={!authorized}
          onClick={() => router.push(`/reservation/${reservationId}/confirmation`)}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}
