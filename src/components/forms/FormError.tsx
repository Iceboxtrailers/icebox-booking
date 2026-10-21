import Link from "next/link";
import { SESSION_LOST_MESSAGE } from "@/lib/api-client";

// The red message under a booking form. When the session is gone it also offers the way back in.
export function FormError({ message, className = "mb-3" }: { message: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className={`${className} text-[13px] text-red-600`}>
      {message}
      {message === SESSION_LOST_MESSAGE && (
        <>
          {" "}
          <Link href="/reservation/invite" className="font-medium underline">
            Reprendre ma réservation
          </Link>
        </>
      )}
    </div>
  );
}
