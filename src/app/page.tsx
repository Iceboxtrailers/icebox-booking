import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CATALOGUE } from "@/lib/catalogue";
import { TRAILER_TYPE_LABEL_FR } from "@/lib/constants";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center gap-2.5">
        <BrandMark size={36} />
        <div className="font-heading text-xl uppercase tracking-wide">IceBox</div>
      </div>

      <div className="mb-6 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <Image
          src="/brand/logo-horizontal.png"
          alt="IceBox"
          width={180}
          height={182}
          className="shrink-0"
          priority
        />
        <div>
          <h1 className="font-heading mb-3 text-2xl leading-tight sm:text-3xl">
            Location de remorques réfrigérées et congelées, au Québec
          </h1>
          <p className="max-w-xl text-[15px] text-muted">
            Réservez en ligne, signez votre contrat électroniquement et confirmez votre location en quelques
            minutes.
          </p>
        </div>
      </div>

      <Link href="/reservation/new">
        <Button variant="cta" className="mb-10">
          Réserver une remorque <ArrowRight size={14} />
        </Button>
      </Link>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CATALOGUE.map((item) => (
          <Card key={item.model} className="p-4">
            <div className="mb-1 text-sm font-medium">
              {TRAILER_TYPE_LABEL_FR[item.type]} {item.size}{" "}
              <span className="text-xs font-normal text-muted">({item.tempRange})</span>
            </div>
            <div className="mb-2 text-xs text-muted">{item.description}</div>
            <div className="font-mono text-sm font-medium">{(item.dailyRateCents / 100).toFixed(2)} $/jour</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
