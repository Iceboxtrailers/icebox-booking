"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";

// A guest has no client area: when the booking is done, closing the session is the way out.
export function GuestDoneButton() {
  return (
    <Button type="button" variant="cta" onClick={() => signOut({ callbackUrl: "/" })}>
      Terminer et fermer la session
    </Button>
  );
}
