import { Suspense } from "react";
import { MarketingLayout } from "@/components/MarketingLayout";
import { Card } from "@/components/ui/Card";
import { SecureDepositForm } from "@/components/forms/SecureDepositForm";
import { findReservationByDepositToken } from "@/lib/deposit-link";
import { DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";
import { fmt } from "@/lib/dates";

export const metadata = { title: "Dépôt de sécurité — IceBox", robots: { index: false, follow: false } };

export default async function SecureDepositPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reservation = await findReservationByDepositToken(token);
  const amount = (DEPOSIT_AMOUNT_CENTS / 100).toLocaleString("fr-CA", { maximumFractionDigits: 0 });

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-md">
        <h1 className="font-heading mb-3 text-2xl">Dépôt de sécurité</h1>
        {!reservation ? (
          <Card className="p-4 text-[13px] text-muted">
            Ce lien est invalide ou expiré. Communiquez avec IceBox au{" "}
            <a href="tel:+15818892093" className="text-navy underline">
              581 889-2093
            </a>{" "}
            pour en recevoir un nouveau.
          </Card>
        ) : (
          <>
            <p className="mb-4 text-[13px] text-muted">
              Bonjour {reservation.client.firstName}, pour la remise de votre remorque
              {reservation.trailer ? ` ${reservation.trailer.size}` : ""}
              {reservation.pickupDate && reservation.returnDate
                ? ` (${fmt(reservation.pickupDate.toISOString().slice(0, 10))} → ${fmt(reservation.returnDate.toISOString().slice(0, 10))})`
                : ""}
              , un dépôt de {amount} $ doit être retenu sur votre carte. Rien n&apos;est débité : la retenue est
              libérée après le retour conforme de la remorque.
            </p>
            <Suspense>
              <SecureDepositForm token={token} />
            </Suspense>
          </>
        )}
      </div>
    </MarketingLayout>
  );
}
