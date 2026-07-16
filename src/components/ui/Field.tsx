import { ReactNode } from "react";

export function Field({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <div className="mb-3">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
