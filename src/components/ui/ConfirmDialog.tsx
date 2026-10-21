"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";

type ConfirmOptions = { confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type PendingConfirm = { message: string; options: ConfirmOptions };

// In-page replacement for window.confirm(), which some embedded browsers block.
// Usage: const { confirm, dialog } = useConfirm();
//        if (!(await confirm("Annuler cette réservation ?", { danger: true }))) return;
//        ... and render {dialog} once in the component's JSX.
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  // The button that asked: the dialog takes focus (autoFocus), and focus goes back there once it is answered.
  const trigger = useRef<HTMLElement | null>(null);
  const messageId = useId();

  const confirm = useCallback(
    (message: string, options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false); // a newer question replaces an unanswered one
        resolver.current = resolve;
        trigger.current ??= document.activeElement as HTMLElement | null;
        setPending({ message, options });
      }),
    [],
  );

  const answer = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setPending(null);
    trigger.current?.focus?.();
    trigger.current = null;
  }, []);

  useEffect(() => {
    if (!pending) return;
    // Capture phase and stopPropagation: while a question is open, Escape answers it and does not also
    // close the modal underneath.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        answer(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [pending, answer]);

  // A dialog that disappears with its component must not leave the caller waiting forever.
  useEffect(() => {
    const pendingResolver = resolver;
    return () => {
      pendingResolver.current?.(false);
    };
  }, []);

  const dialog = pending
    ? createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            event.stopPropagation();
            answer(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmation"
            aria-describedby={messageId}
            className="w-full max-w-sm rounded-xl bg-white p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <p id={messageId} className="mb-5 whitespace-pre-line text-[14px] text-foreground">
              {pending.message}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" autoFocus onClick={() => answer(false)}>
                {pending.options.cancelLabel ?? "Annuler"}
              </Button>
              <Button type="button" variant={pending.options.danger ? "danger" : "cta"} onClick={() => answer(true)}>
                {pending.options.confirmLabel ?? "Confirmer"}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return { confirm, dialog };
}
