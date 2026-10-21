import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { FAQ_ITEMS } from "@/lib/faq";

// The questions that can stop someone from booking (marked `home` in src/lib/faq.ts).
export function FaqHighlights() {
  const items = FAQ_ITEMS.filter((item) => item.home);
  return (
    <section className="mb-14">
      <h2 className="font-heading mb-5 text-xl">Avant de réserver</h2>

      <div className="space-y-2">
        {items.map((item) => (
          <details key={item.q} className="group rounded-lg border border-border-light bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown size={16} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-4 pb-4 text-[13px] leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>

      <Link href="/faq" className="mt-2 inline-flex items-center gap-1.5 py-2 text-[13px] font-medium text-navy hover:underline">
        Toutes les questions <ArrowRight size={14} />
      </Link>
    </section>
  );
}
