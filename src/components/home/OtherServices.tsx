import Link from "next/link";
import { ArrowRight } from "lucide-react";

const SERVICES = [
  { label: "Chambres froides sur mesure", href: "/chambre-froide" },
  { label: "Chambres de congélation", href: "/chambre-congelation" },
  { label: "Attaches et accessoires", href: "/attaches-accessoires" },
  { label: "Devenir concessionnaire", href: "/devenir-concessionnaire" },
];

// Deliberately quiet: renting a trailer is the main action of the page.
export function OtherServices() {
  return (
    <section>
      <div className="mb-3 text-[12px] font-medium uppercase tracking-wide text-muted">Autres services</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((service) => (
          <Link
            key={service.href}
            href={service.href}
            className="flex items-center justify-between gap-2 rounded-lg border border-border-light bg-white px-3.5 py-2.5 text-[13px] text-foreground hover:border-navy hover:text-navy"
          >
            {service.label}
            <ArrowRight size={14} className="shrink-0 text-muted" />
          </Link>
        ))}
      </div>
    </section>
  );
}
