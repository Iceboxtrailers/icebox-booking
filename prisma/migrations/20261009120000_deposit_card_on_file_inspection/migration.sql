-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "stripeCustomerId" TEXT;

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "stripePaymentMethodId" TEXT,
ADD COLUMN     "depositExpiresAt" TIMESTAMP(3),
ADD COLUMN     "depositToken" TEXT,
ADD COLUMN     "depositTokenExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "return_inspections" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "photoPaths" TEXT[],
    "inspectedByAdminId" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "depositReleasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reservationId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_stripeCustomerId_key" ON "clients"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_depositToken_key" ON "reservations"("depositToken");

-- CreateIndex
CREATE UNIQUE INDEX "return_inspections_reservationId_key" ON "return_inspections"("reservationId");

-- CreateIndex
CREATE INDEX "audit_logs_reservationId_createdAt_idx" ON "audit_logs"("reservationId", "createdAt");

-- AddForeignKey
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
