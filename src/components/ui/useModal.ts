"use client";

import { useEffect, useId, useRef } from "react";

// Open modals, oldest first: Escape only closes the one on top (a client sheet opened from a booking
// sheet closes first).
const openModals: string[] = [];

// What a modal needs besides its look: Escape closes it, focus moves into it when it opens and goes back
// to where it was when it closes, and screen readers get it as a titled dialog.
// Spread `dialogProps` on the panel and put `id={titleId}` on its heading.
export function useModal(onClose: () => void) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openModals.push(id);
    panelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openModals[openModals.length - 1] === id) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const index = openModals.indexOf(id);
      if (index >= 0) openModals.splice(index, 1);
      previouslyFocused?.focus?.();
    };
  }, [id]);

  return {
    titleId: id,
    dialogProps: {
      ref: panelRef,
      role: "dialog" as const,
      "aria-modal": true as const,
      "aria-labelledby": id,
      tabIndex: -1,
    },
  };
}
