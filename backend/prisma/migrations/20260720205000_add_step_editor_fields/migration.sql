-- AlterTable
ALTER TABLE "procedure_steps" ADD COLUMN "explanation" TEXT;
ALTER TABLE "procedure_steps" ADD COLUMN "helperMessage" TEXT;
ALTER TABLE "procedure_steps" ADD COLUMN "highlighted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "procedure_steps" ADD COLUMN "isFinal" BOOLEAN NOT NULL DEFAULT false;
