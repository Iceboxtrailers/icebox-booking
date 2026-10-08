-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "deliveryOption" TEXT NOT NULL DEFAULT 'pickup',
ADD COLUMN     "deliveryDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0;
