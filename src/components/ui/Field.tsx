"use client";

import { ReactNode, useId } from "react";

// A form field with its caption. The caption wraps the control, so tapping the text focuses the field and
// screen readers announce it. Pass `group` when the field holds several controls (a row of buttons): the
// caption then names the group instead.
export function Field({
  label,
  children,
  error,
  group = false,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  group?: boolean;
}) {
  const captionId = useId();
  const caption = (
    <span id={captionId} className="mb-1 block text-[11px] uppercase tracking-wide text-muted">
      {label}
    </span>
  );
  const message = error && (
    <span role="alert" className="mt-1 block text-[11px] text-red-600">
      {error}
    </span>
  );

  if (group) {
    return (
      <div role="group" aria-labelledby={captionId} className="mb-3">
        {caption}
        {children}
        {message}
      </div>
    );
  }
  // The message stays outside the label so it does not become part of the control's name.
  return (
    <div className="mb-3">
      <label className="block">
        {caption}
        {children}
      </label>
      {message}
    </div>
  );
}
