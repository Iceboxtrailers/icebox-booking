import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { fmt } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { GuestDoneButton } from "@/components/forms/GuestDoneButton";

export function ConfirmationSummary({
  firstName,
  lastName,
  trailerSize,
  start,
  end,
  guest = false,
}: {
  firstName: string;
  lastName: string;
  trailerSize: string;
  start: string;
  end: string;
  /** booking without an account: no client area to go back to */
  guest?: boolean;
}) {
  return (
    <div className="py-5 text-center">
      <CheckCircle2 size={42} className="mx-auto text-success" />
      <div className="font-heading mt-2.5 mb-1 text-lg">Réservation confirmée</div>
      <div className="mb-4 text-[13px] text-muted">
        Remorque {trailerSize} du {fmt(start)} au {fmt(end)} pour {firstName} {lastName}.
      </div>
      <div className="mx-auto mb-5 max-w-sm text-[12px] text-muted">
        Un courriel de confirmation avec copie du contrat signé vous a été envoyé.
      </div>
      {guest ? (
        <>
          <div className="mx-auto mb-5 max-w-sm text-[12px] text-muted">
            Aucun compte n&apos;a été créé : conservez ce courriel, il contient votre contrat. Pour toute question,
            appelez-nous au 581 889-2093.
          </div>
          <GuestDoneButton />
        </>
      ) : (
        <Link href="/compte/reservations">
          <Button type="button" variant="cta">
            Retourner à l&apos;espace client
          </Button>
        </Link>
      )}
    </div>
  );
}
