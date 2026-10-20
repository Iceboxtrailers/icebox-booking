import Image from "next/image";
import { Check } from "lucide-react";

// From the equipment lists of the rental contract and the offer sheet (both sizes).
const INTERIOR_FEATURES = [
  "Isolation R-32",
  "Rails pour suspension de viande",
  "Éclairage DEL",
  "Drain de plancher",
  "Surveillance de température",
];

export function InteriorSection() {
  return (
    <section className="mb-14">
      <h2 className="font-heading mb-5 text-xl">À l&apos;intérieur</h2>

      <div className="grid items-center gap-8 md:grid-cols-[1fr_minmax(0,300px)]">
        <div>
          <p className="mb-4 max-w-md text-[15px] leading-relaxed">
            Un intérieur isolé, éclairé et équipé de rails pour suspendre vos produits.
          </p>
          <ul className="space-y-2 text-[13px]">
            {INTERIOR_FEATURES.map((label) => (
              <li key={label} className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-navy" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <figure className="mx-auto w-full max-w-[300px] md:max-w-none">
          <Image
            src="/photos/remorque-5x10-interieur.jpg"
            alt="Intérieur d'une remorque ICEBOX 5×10 : parois blanches, éclairage DEL, rails de suspension et plancher en aluminium"
            width={900}
            height={1215}
            sizes="(min-width: 768px) 300px, 100vw"
            className="h-auto w-full rounded-2xl shadow-md"
          />
          <figcaption className="mt-2 text-center text-[11px] text-muted">Intérieur d&apos;une remorque 5×10</figcaption>
        </figure>
      </div>
    </section>
  );
}
