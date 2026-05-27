-- AlterTable
ALTER TABLE "RetroCard" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "migratedTo" TEXT;
