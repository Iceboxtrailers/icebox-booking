import { Mail, Phone, MapPin } from "lucide-react";
import { MarketingLayout } from "@/components/MarketingLayout";
import { LeadContactForm } from "@/components/forms/LeadContactForm";

export const metadata = { title: "Contact — IceBox" };

export default function ContactPage() {
  return (
    <MarketingLayout>
      <h1 className="font-heading mb-3 text-2xl">Contact</h1>
      <p className="mb-6 max-w-2xl text-[15px] text-muted">
        Une question sur une réservation, nos remorques ou nos services ? Écrivez-nous ou appelez-nous
        directement.
      </p>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="max-w-md">
          <LeadContactForm topic="Contact général" />
        </div>

        <div className="space-y-3 text-[13px]">
          <div className="flex items-center gap-2 text-foreground">
            <Mail size={15} />
            <a href="mailto:info@iceboxtrailers.ca" className="hover:text-navy">
              info@iceboxtrailers.ca
            </a>
          </div>
          <div className="flex items-center gap-2 text-foreground">
            <Phone size={15} />
            <a href="tel:+15818892093" className="hover:text-navy">
              Bureau : 581 889-2093
            </a>
          </div>
          <div className="flex items-center gap-2 text-foreground">
            <Phone size={15} />
            <a href="tel:+14185764147" className="hover:text-navy">
              Urgence 24/7 : 418 576-4147
            </a>
          </div>
          <div className="flex items-start gap-2 text-muted">
            <MapPin size={15} className="mt-0.5 shrink-0" />
            1005 rue du Parc-Industriel, Lévis, QC G6Z 1C5
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
