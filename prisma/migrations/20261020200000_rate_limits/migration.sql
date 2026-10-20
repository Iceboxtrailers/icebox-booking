-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "bucket" BIGINT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" BIGINT NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key","bucket")
);

-- CreateIndex
CREATE INDEX "rate_limits_expiresAt_idx" ON "rate_limits"("expiresAt");
