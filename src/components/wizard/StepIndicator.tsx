import { Check } from "lucide-react";
import { WIZARD_STEPS } from "@/lib/wizard";

export function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1">
      {WIZARD_STEPS.map((label, i) => (
        <div
          key={label}
          className={`flex items-center gap-1.5 text-[11px] ${
            i === currentStep ? "text-navy" : i < currentStep ? "text-success" : "text-[#9AA5AB]"
          }`}
        >
          <span
            className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] ${
              i === currentStep
                ? "bg-navy text-white"
                : i < currentStep
                  ? "bg-success text-white"
                  : "bg-[#E4E8EA] text-[#7A848A]"
            }`}
          >
            {i < currentStep ? <Check size={12} /> : i + 1}
          </span>
          {i < WIZARD_STEPS.length - 1 && <span className="h-px w-3.5 bg-[#D8DEE2]" />}
        </div>
      ))}
    </div>
  );
}
