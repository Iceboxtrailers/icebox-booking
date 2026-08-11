import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { fmt } from "@/lib/dates";
import { Button } from "@/components/ui/Button";

export function ConfirmationSummary({
  firstName,
  lastName,
  trailerSize,
  start,
  end,
}: {
  firstName: string;
  lastName: string;
  trailerSize: string;
  start: string;
  end: string;
}) {
  return (
    <div className="py-5 text-center">
      <CheckCircle2 size={42} color="#4C9A6A" className="mx-auto" />
      <div className="font-heading mt-2.5 mb-1 text-lg">Réservation confirmée</div>
      <div className="mb-4 text-[13px] text-muted">
        Remorque {trailerSize} du {fmt(start)} au {fmt(end)} pour {firstName} {lastName}.
      </div>
      <div className="mx-auto mb-5 max-w-sm text-[12px] text-muted">
        Un courriel de confirmation avec copie du contrat signé vous a été envoyé.
      </div>
      <Link href="/compte/reservations">
        <Button type="button" variant="cta">
          Retourner à l&apos;espace client
        </Button>
      </Link>
    </div>
  );
}
