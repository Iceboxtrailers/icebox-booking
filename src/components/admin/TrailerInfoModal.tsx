"use client";

import { X } from "lucide-react";
import { useModal } from "@/components/ui/useModal";

export function TrailerInfoModal({
  trailer,
  onClose,
}: {
  trailer: {
    name: string;
    size: string;
    imageUrl: string | null;
    description: string | null;
    plate: string | null;
  };
  onClose: () => void;
}) {
  const { titleId, dialogProps } = useModal(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        {...dialogProps}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-5 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div id={titleId} className="font-heading text-lg">{trailer.name}</div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-muted hover:text-foreground">
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
        {trailer.plate && (
          <div className="mb-2 text-[13px]">
            <span className="text-muted">Immatriculation : </span>
            <span className="font-mono">{trailer.plate}</span>
          </div>
        )}
        <div className="text-[13px] leading-relaxed text-body">
          {trailer.description || "Aucune description."}
        </div>
      </div>
    </div>
  );
}
