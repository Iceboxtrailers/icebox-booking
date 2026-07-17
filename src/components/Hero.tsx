import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Background is a brand-color gradient placeholder until real trailer
// photos/video are available — swap the background layer below for an
// <img>/<video> without touching the rest of the layout.
export function Hero() {
  return (
    <section
      className="-mx-4 mb-8 px-4 py-12 sm:py-16"
      style={{ background: "linear-gradient(135deg, #ffffff 0%, var(--color-tint-40) 100%)" }}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center sm:flex-row sm:text-left">
        <Image
          src="/brand/logo-horizontal.png"
          alt="IceBox"
          width={200}
          height={202}
          className="shrink-0"
          priority
        />
        <div>
          <h1 className="font-heading mb-3 text-2xl leading-tight sm:text-4xl">
            Location de remorques réfrigérées et congelées, au Québec
          </h1>
          <p className="mb-5 max-w-xl text-[15px] text-foreground/80">
            Réservez en ligne, signez votre contrat électroniquement et confirmez votre location en quelques
            minutes.
          </p>
          <Link href="/reservation/new">
            <Button variant="cta">
              Réserver une remorque <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
