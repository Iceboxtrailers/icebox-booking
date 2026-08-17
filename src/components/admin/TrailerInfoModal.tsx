"use client";

import { X } from "lucide-react";

export function TrailerInfoModal({
  trailer,
  onClose,
}: {
  trailer: { name: string; size: string; imageUrl: string | null; description: string | null };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="font-heading text-lg">{trailer.name}</div>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {trailer.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, admin-only blob URL, not a static asset next/image can optimize
          <img
            src={trailer.imageUrl}
            alt={trailer.name}
            className="mb-3 w-full rounded-lg border border-border-light object-cover"
          />
        ) : (
          <div className="mb-3 flex h-32 items-center justify-center rounded-lg border border-dashed border-border-light text-[12px] text-muted">
            Aucune image
          </div>
        )}

        <div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted">{trailer.size}</div>
        <div className="text-[13px] leading-relaxed text-[#3A454E]">
          {trailer.description || "Aucune description."}
        </div>
      </div>
    </div>
  );
}
