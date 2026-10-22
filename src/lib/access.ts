// Who may open which page or API (the middleware applies this to the paths it watches). The console and
// the booking pages have separate sessions: an admin session says nothing about the client one, and the
// other way round.

export type Access =
  | { kind: "allow" }
  // Send the visitor to a sign-in page, and bring them back to `callbackUrl` afterwards.
  | { kind: "redirect"; to: "/admin/login" | "/login"; callbackUrl: string }
  // An API answers 401 instead of redirecting.
  | { kind: "unauthorized" };

const allow: Access = { kind: "allow" };

export function decideAccess(input: { pathname: string; adminId: string | null; clientId: string | null }): Access {
  const { pathname, adminId, clientId } = input;

  if (pathname.startsWith("/dashboard")) {
    return adminId ? allow : { kind: "redirect", to: "/admin/login", callbackUrl: pathname };
  }

  // Fleet photos and return-inspection photos are staff-only assets, not client-owned documents: the
  // client-session rule below would otherwise bounce staff to /login before the route's own check runs.
  if (pathname.startsWith("/api/files/trailers") || pathname.startsWith("/api/files/inspections")) {
    return adminId ? allow : { kind: "unauthorized" };
  }

  // Staff are a party to every contract and check the licence and insurance proof of the people they hand
  // a trailer to, so a staff session alone reaches these. The route still checks ownership for a client.
  if (
    pathname.startsWith("/api/files/contracts") ||
    pathname.startsWith("/api/files/signatures") ||
    pathname.startsWith("/api/files/documents")
  ) {
    return adminId || clientId ? allow : { kind: "unauthorized" };
  }

  // The guest-checkout page is how a visitor gets a client session: it cannot require one already.
  if (pathname === "/reservation/invite") return allow;

  return clientId ? allow : { kind: "redirect", to: "/login", callbackUrl: pathname };
}
