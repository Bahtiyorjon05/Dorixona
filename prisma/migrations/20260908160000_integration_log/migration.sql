-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "keys" TEXT,
    "sample" TEXT,
    "note" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationLog_source_createdAt_idx" ON "IntegrationLog"("source", "createdAt");
