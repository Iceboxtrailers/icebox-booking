"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Snowflake, Zap, Truck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

const FEATURES = [
  { icon: Snowflake, label: "Jusqu'à -18 °C" },
  { icon: Zap, label: "Branchement simple" },
  { icon: Truck, label: "Livraison disponible" },
  { icon: CheckCircle2, label: "Réservation en ligne" },
];

// First screen: a real ICEBOX trailer, one short hook, and the date search.
export function Hero() {
  const router = useRouter();
  const [pickupDate, setPickupDate] = useState("");
  const [returnDate, setReturnDate] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (pickupDate) params.set("pickupDate", pickupDate);
    if (returnDate) params.set("returnDate", returnDate);
    const qs = params.toString();
    router.push(`/reservation/invite${qs ? `?${qs}` : ""}`);
  }

  return (
    <section
      id="disponibilites"
      className="-mx-4 mb-14 scroll-mt-4 px-4 py-8 sm:py-12"
      style={{ background: "linear-gradient(135deg, #ffffff 0%, var(--color-tint-40) 100%)" }}
    >
      <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-2 md:gap-10">
        <div className="md:order-2">
          <Image
            src="/photos/remorque-icebox-cote.jpg"
            alt="Remorque réfrigérée ICEBOX, vue de côté, avec le logo et le numéro de location"
            width={1800}
            height={1350}
            priority
            sizes="(min-width: 768px) 520px, 100vw"
            className="h-auto w-full rounded-2xl shadow-lg max-md:aspect-[16/9] max-md:object-cover max-md:object-[center_15%]"
          />
        </div>

        <div className="md:order-1">
          <h1 className="font-heading mb-3 text-[26px] leading-tight sm:text-4xl">
            Une remorque réfrigérée, quand vous en avez besoin.
          </h1>
          <p className="mb-5 max-w-md text-[14px] leading-relaxed text-muted">
            Pour vos événements, vos besoins commerciaux et vos imprévus. Choisissez vos dates et trouvez une
            remorque adaptée à votre besoin de réfrigération ou de congélation.
          </p>

          <form
            onSubmit={handleSearch}
            className="mb-4 flex flex-col gap-2 rounded-xl border border-border-light bg-white p-2.5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                required
                aria-label="Date de ramassage"
                className="min-w-0 flex-1 rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-navy"
              />
              <span className="hidden text-muted sm:inline">au</span>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
                aria-label="Date de retour"
                className="min-w-0 flex-1 rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-navy"
              />
            </div>
            <Button type="submit" variant="cta" className="justify-center">
              Voir les disponibilités <ArrowRight size={14} />
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
            {FEATURES.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <Icon size={14} className="text-navy" /> {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
