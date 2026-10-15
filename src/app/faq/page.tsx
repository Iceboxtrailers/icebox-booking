import { MarketingLayout } from "@/components/MarketingLayout";
import { FAQ_ITEMS } from "@/lib/faq";

export const metadata = { title: "FAQ — IceBox" };

export default function FaqPage() {
  return (
    <MarketingLayout>
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
