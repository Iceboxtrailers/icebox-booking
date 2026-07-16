import { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { WIZARD_STEPS } from "@/lib/wizard";

export function WizardShell({ step, children }: { step: number; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <div className="mb-1.5 flex items-center gap-2.5">
        <BrandMark size={32} />
        <div className="font-heading text-lg uppercase tracking-wide">Réservation en ligne</div>
        <div className="ml-auto">
          <Pill>Prototype — aucune donnée réelle traitée</Pill>
        </div>
      </div>

      <StepIndicator currentStep={step} />
      <div className="font-heading mb-4 text-xl">{WIZARD_STEPS[step]}</div>

      <Card className="p-5">{children}</Card>
    </div>
  );
}
