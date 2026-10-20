import { MarketingLayout } from "@/components/MarketingLayout";
import { JsonLd } from "@/components/JsonLd";
import { FAQ_ITEMS } from "@/lib/faq";
import { faqJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "FAQ — IceBox",
  path: "/faq",
  description: "Questions fréquentes sur la location d'une remorque réfrigérée IceBox : tailles, véhicule, alimentation électrique, dépôt de sécurité, assurance et livraison.",
});

export default function FaqPage() {
  return (
    <MarketingLayout>
      <JsonLd data={faqJsonLd(FAQ_ITEMS)} />
      <h1 className="font-heading mb-6 text-2xl">Questions fréquentes</h1>
      <div className="max-w-2xl space-y-5">
        {FAQ_ITEMS.map((item) => (
          <div key={item.q}>
            <div className="mb-1 text-[14px] font-medium">{item.q}</div>
            <div className="text-[13px] text-muted">{item.a}</div>
          </div>
        ))}
      </div>
    </MarketingLayout>
  );
}
