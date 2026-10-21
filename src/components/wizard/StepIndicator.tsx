import { Check } from "lucide-react";
import { WIZARD_STEPS } from "@/lib/wizard";

// Progress through the booking. The state of each step is carried by text for screen readers (and
// aria-current on the one in progress), not only by colour; upcoming steps use the darker reading colour
// so their small numbers keep enough contrast on the grey disc.
export function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <ol aria-label="Progression de la réservation" className="mb-5 flex flex-wrap gap-1">
      {WIZARD_STEPS.map((label, i) => {
        const state = i === currentStep ? "en cours" : i < currentStep ? "terminée" : "à venir";
        return (
          <li
            key={label}
            aria-current={i === currentStep ? "step" : undefined}
            className={`flex items-center gap-1.5 text-[11px] ${
              i === currentStep ? "text-navy" : i < currentStep ? "text-success" : "text-body"
            }`}
          >
            <span
              aria-hidden
              className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] ${
                i === currentStep
                  ? "bg-navy text-white"
                  : i < currentStep
                    ? "bg-success text-white"
                    : "bg-border-light text-body"
              }`}
            >
              {i < currentStep ? <Check size={12} /> : i + 1}
            </span>
            <span className="sr-only">
              Étape {i + 1} sur {WIZARD_STEPS.length} : {label}, {state}
            </span>
            {i < WIZARD_STEPS.length - 1 && <span aria-hidden className="h-px w-3.5 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
