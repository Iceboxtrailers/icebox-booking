"use client";

import Link from "next/link";
import { buttonClassName } from "@/components/ui/Button";

// Shown when something breaks while a page is being displayed. The reference code is what to quote
// to find the matching entry in the server logs.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-heading text-2xl">Un problème est survenu</h1>
      <p className="mt-3 text-[15px] text-muted">
        Quelque chose n&apos;a pas fonctionné de notre côté. Réessayez dans un instant; si le problème continue, appelez-nous au{" "}
        <a href="tel:+15818892093" className="text-navy underline">
          581 889-2093
        </a>
        .
      </p>
      {error.digest && <p className="mt-2 text-[12px] text-muted">Code de référence : {error.digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={buttonClassName("cta")}>
          Réessayer
        </button>
        <Link href="/" className={buttonClassName()}>
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
