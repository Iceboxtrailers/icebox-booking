import Link from "next/link";
import type { Metadata } from "next";
import { MarketingLayout } from "@/components/MarketingLayout";
import { buttonClassName } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Page introuvable — IceBox", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-xl py-10 text-center">
        <div className="font-heading text-5xl text-navy">404</div>
        <h1 className="font-heading mt-3 text-2xl">Page introuvable</h1>
        <p className="mt-3 text-[15px] text-muted">
          Cette page n&apos;existe pas ou a été déplacée. Vous pouvez revenir à l&apos;accueil, réserver une remorque ou nous
          joindre.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonClassName("cta")}>
            Retour à l&apos;accueil
          </Link>
          <Link href="/reservation/invite" className={buttonClassName()}>
            Réserver une remorque
          </Link>
          <Link href="/contact" className={buttonClassName()}>
            Nous joindre
          </Link>
        </div>
      </div>
    </MarketingLayout>
  );
}
