-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "totpSecretEnc" TEXT,
ADD COLUMN     "totpPendingEnc" TEXT,
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpLastUsedStep" INTEGER,
ADD COLUMN     "recoveryCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "loginFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loginLockedUntil" TIMESTAMP(3);
