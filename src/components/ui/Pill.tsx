import { ReactNode } from "react";

export function Pill({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" }) {
  const tones = {
    warn: "bg-warn-bg text-warn-text",
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] ${tones[tone]}`}>{children}</span>;
}
