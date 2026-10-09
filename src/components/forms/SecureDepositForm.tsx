"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/Button";

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY!);
  return stripePromise;
}

async function authorizeOnServer(token: string, transactionId: string) {
  const res = await fetch(`/api/deposit-link/${token}/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Impossible d'autoriser le dépôt");
  }
}

function HoldForm({ token, onDone }: { token: string; onDone: () => void }) {
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
        confirmParams: { return_url: window.location.href },
      });
      if (confirmError) {
        setError(confirmError.message ?? "La carte a été refusée");
        return;
      }
      if (!paymentIntent || paymentIntent.status !== "requires_capture") {
        setError("Le dépôt n'a pas pu être autorisé");
        return;
      }
      await authorizeOnServer(token, paymentIntent.id);
      onDone();
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

export function SecureDepositForm({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const [done, setDone] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (done) return;
    const redirectedIntentId = searchParams.get("payment_intent");
    const redirectStatus = searchParams.get("redirect_status");
    if (redirectedIntentId && redirectStatus === "succeeded") {
      authorizeOnServer(token, redirectedIntentId)
        .then(() => setDone(true))
        .catch((err) => setError(err instanceof Error ? err.message : "Impossible d'autoriser le dépôt"));
    }
  }, [done, token, searchParams]);

  const intentRequested = useRef(false);
  useEffect(() => {
    if (done || intentRequested.current || !PUBLISHABLE_KEY || searchParams.get("payment_intent")) return;
    intentRequested.current = true;
    (async () => {
      const res = await fetch(`/api/deposit-link/${token}/intent`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible de préparer le paiement");
        return;
      }
      const data = await res.json();
      setClientSecret(data.clientSecret);
    })();
  }, [done, token, searchParams]);

  if (done) {
    return (
      <div className="rounded-lg border border-border-light bg-[#FAFBFB] p-4 text-[13px] text-foreground">
        Merci ! Le dépôt est retenu sur votre carte (aucun montant n&apos;est débité). Vous pouvez fermer cette page.
      </div>
    );
  }

  return (
    <div>
      {!PUBLISHABLE_KEY ? (
        <div className="text-[13px] text-muted">Le paiement en ligne n&apos;est pas configuré.</div>
      ) : clientSecret ? (
        <Elements stripe={getStripe()} options={{ clientSecret }}>
          <HoldForm token={token} onDone={() => setDone(true)} />
        </Elements>
      ) : (
        !error && <div className="text-[13px] text-muted">Chargement du paiement...</div>
      )}
      {error && <div className="mt-3 text-[13px] text-red-600">{error}</div>}
    </div>
  );
}
