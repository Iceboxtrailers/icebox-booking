// Browser-side helpers for the booking pages: what to tell the person when a request fails.

// The booking session is gone: a guest session lasts a few hours, and signing in to another client account
// in the same browser replaces it. (The console has its own session and does not interfere.) The server then
// answers with a redirect to the login page instead of JSON, which used to surface as a vague "could not save".
export const SESSION_LOST_MESSAGE =
  "Votre session de réservation est terminée. Elle dure quelques heures et prend fin si vous vous connectez à un autre compte dans le même navigateur.";

export async function apiErrorMessage(res: Response, fallback: string): Promise<string> {
  if (res.redirected || res.status === 401) return SESSION_LOST_MESSAGE;
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  return typeof data.error === "string" ? data.error : fallback;
}
