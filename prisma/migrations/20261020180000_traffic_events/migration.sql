-- CreateTable
CREATE TABLE "traffic_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "day" TEXT NOT NULL,
    "visitor" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "source" TEXT,
    "device" TEXT NOT NULL,
    "country" TEXT,
    "region" TEXT,

    CONSTRAINT "traffic_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traffic_events_createdAt_idx" ON "traffic_events"("createdAt");

-- CreateIndex
CREATE INDEX "traffic_events_day_visitor_idx" ON "traffic_events"("day", "visitor");
