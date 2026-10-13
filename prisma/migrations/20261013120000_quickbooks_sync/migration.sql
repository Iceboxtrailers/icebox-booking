-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "qbCustomerId" TEXT;

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "qbInvoiceId" TEXT,
ADD COLUMN     "qbInvoiceNumber" TEXT,
ADD COLUMN     "qbSyncStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "qbSyncError" TEXT,
ADD COLUMN     "qbSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "accounting_connections" (
    "id" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "syncFromDate" TIMESTAMP(3) NOT NULL,
    "incomeAccountId" TEXT,
    "taxCodeId" TEXT,
    "rentalItemId" TEXT,
    "transportItemId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_connections_pkey" PRIMARY KEY ("id")
);
