import { CheckCircle2 } from "lucide-react";
import { fmt } from "@/lib/dates";
import { TRAILER_TYPE_LABEL_FR, type TrailerType } from "@/lib/constants";

export function ConfirmationSummary({
  firstName,
  lastName,
  trailerType,
  trailerSize,
  start,
  end,
}: {
  firstName: string;
  lastName: string;
  trailerType: string;
  trailerSize: string;
  start: string;
  end: string;
}) {
  return (
    <div className="py-5 text-center">
      <CheckCircle2 size={42} color="#4C9A6A" className="mx-auto" />
      <div className="font-heading mt-2.5 mb-1 text-lg">Réservation confirmée</div>
      <div className="mb-4 text-[13px] text-muted">
        {TRAILER_TYPE_LABEL_FR[trailerType as TrailerType] ?? trailerType} {trailerSize} du {fmt(start)} au{" "}
        {fmt(end)} pour {firstName}{" "}
        {lastName}.
      </div>
      <div className="mx-auto max-w-sm text-[12px] text-muted">
        Un courriel de confirmation avec copie du contrat signé vous a été envoyé.
      </div>
    </div>
  );
}
