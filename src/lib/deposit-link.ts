import { prisma } from "@/lib/prisma";

// A link is valid while its token matches, it hasn't expired, and the
// reservation is still active. Knowing the 256-bit token is the credential.
export async function findReservationByDepositToken(token: string) {
  if (!token || token.length < 20) return null;
  const reservation = await prisma.reservation.findUnique({
    where: { depositToken: token },
    include: { client: true, trailer: true },
  });
  if (!reservation) return null;
  if (!reservation.depositTokenExpiresAt || reservation.depositTokenExpiresAt < new Date()) return null;
  if (reservation.status !== "confirmed" && reservation.status !== "in_progress") return null;
  return reservation;
}
