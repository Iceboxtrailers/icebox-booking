import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border-light bg-white">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:grid-cols-3">
        <div>
          <div className="font-heading mb-2 text-sm uppercase tracking-wide">IceBox</div>
          <div className="text-[12px] text-muted">Remorques Réfrigérées ICEBOX Inc.</div>
          <div className="mt-1 flex items-start gap-1.5 text-[12px] text-muted">
            <MapPin size={13} className="mt-0.5 shrink-0" />
            1005 rue du Parc-Industriel, Lévis, QC G6Z 1C5
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">Contact</div>
          <div className="flex items-center gap-1.5 text-[12px] text-foreground">
            <Mail size={13} />
            <a href="mailto:info@iceboxtrailers.ca" className="hover:text-navy">
              info@iceboxtrailers.ca
            </a>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-foreground">
            <Phone size={13} />
            <a href="tel:+15818892093" className="hover:text-navy">
              Bureau : 581 889-2093
            </a>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-foreground">
            <Phone size={13} />
            <a href="tel:+14185764147" className="hover:text-navy">
              Cellulaire : 418 576-4147
            </a>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">Liens</div>
          <div className="flex flex-col gap-1 text-[12px]">
            <Link href="/chambre-froide" className="text-foreground hover:text-navy">
              Chambre froide
            </Link>
            <Link href="/chambre-congelation" className="text-foreground hover:text-navy">
              Chambre de congélation
            </Link>
            <Link href="/attaches-accessoires" className="text-foreground hover:text-navy">
              Attaches & accessoires
            </Link>
            <Link href="/devenir-concessionnaire" className="text-foreground hover:text-navy">
              Devenir concessionnaire
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
