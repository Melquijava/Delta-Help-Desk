-- AlterTable
ALTER TABLE "procedures" ADD COLUMN "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[];
