import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Short version of /comment-ca-marche (same wording, grouped in three steps).
const STEPS = [
  {
    title: "Choisissez vos dates",
    text: "On vous montre les remorques réellement disponibles pour ces dates, avec le prix déjà calculé.",
  },
  {
    title: "Réservez en ligne",
    text: "Documents, contrat signé à l'écran et carte enregistrée pour le dépôt de sécurité. Aucun compte requis.",
  },
  {
    title: "Ramassez ou faites-vous livrer",
    text: "Ramassage au dépôt de Lévis ou livraison. Le dépôt de sécurité est seulement retenu, jamais débité, et libéré après le retour.",
  },
];

export function HowItWorks() {
  return (
    <section className="mb-14">
      <h2 className="font-heading mb-5 text-xl">Comment ça marche</h2>

      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,260px)_1fr]">
        <Image
          src="/photos/remorque-6x12-porte.jpg"
          alt="Porte arrière d'une remorque ICEBOX, avec le marchepied et le numéro de location"
          width={1000}
          height={1399}
          sizes="(min-width: 768px) 260px, 100vw"
          className="mx-auto h-auto w-full max-w-[280px] rounded-2xl shadow-md md:max-w-none"
        />

        <div>
          <ol className="space-y-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <div className="text-[15px] font-semibold">{step.title}</div>
                  <div className="text-[13px] text-muted">{step.text}</div>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/comment-ca-marche"
            className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-navy hover:underline"
          >
            Voir toutes les étapes <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
