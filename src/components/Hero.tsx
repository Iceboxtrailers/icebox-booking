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

// Background is a brand-color gradient placeholder until real trailer
// photos/video are available — swap the background layer below for an
// <img>/<video> without touching the rest of the layout.
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
      className="-mx-4 mb-8 px-4 py-12 sm:py-16"
      style={{ background: "linear-gradient(135deg, #ffffff 0%, var(--color-tint-40) 100%)" }}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center sm:flex-row sm:text-left">
        <Image
          src="/brand/logo-horizontal.png"
          alt="IceBox"
          width={160}
          height={162}
          className="hidden shrink-0 sm:block"
          priority
        />
        <div className="w-full">
          <h1 className="font-heading mb-2 text-2xl leading-tight sm:text-4xl">
            Gardez ça froid. On s&apos;occupe du reste.
          </h1>
          <p className="mb-5 max-w-xl text-[15px] text-foreground/80">
            Remorques réfrigérées et congelées disponibles partout au Québec.
          </p>

          <form
            onSubmit={handleSearch}
            className="mb-4 flex flex-col gap-2 rounded-xl border border-border-light bg-white p-2.5 sm:flex-row sm:items-center"
          >
            <input
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              required
              aria-label="Date de ramassage"
              className="flex-1 rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-navy"
            />
            <span className="hidden text-muted sm:inline">au</span>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required
              aria-label="Date de retour"
              className="flex-1 rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-navy"
            />
            <Button type="submit" variant="cta" className="justify-center">
              Voir les disponibilités <ArrowRight size={14} />
            </Button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-foreground/80 sm:justify-start">
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
