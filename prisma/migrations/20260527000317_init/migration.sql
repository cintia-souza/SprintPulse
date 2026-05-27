-- CreateEnum
CREATE TYPE "CardColumn" AS ENUM ('WENT_WELL', 'IMPROVE', 'ACTION_ITEMS');

-- CreateTable
CREATE TABLE "RetroSession" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'writing',
    "revealedColumns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "RetroSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetroCard" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "column" "CardColumn" NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetroCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetroSession_roomId_key" ON "RetroSession"("roomId");

-- CreateIndex
CREATE INDEX "RetroSession_roomId_idx" ON "RetroSession"("roomId");

-- CreateIndex
CREATE INDEX "RetroCard_sessionId_column_idx" ON "RetroCard"("sessionId", "column");

-- AddForeignKey
ALTER TABLE "RetroCard" ADD CONSTRAINT "RetroCard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RetroSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
