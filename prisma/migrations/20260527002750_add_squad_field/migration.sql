-- AlterTable
ALTER TABLE "RetroSession" ADD COLUMN     "squad" TEXT NOT NULL DEFAULT 'default';

-- CreateIndex
CREATE INDEX "RetroSession_squad_idx" ON "RetroSession"("squad");
