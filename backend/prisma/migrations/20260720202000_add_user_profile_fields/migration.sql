-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "registration" TEXT;
ALTER TABLE "users" ADD COLUMN "notes" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_registration_key" ON "users"("registration");

-- CreateIndex
CREATE INDEX "users_registration_idx" ON "users"("registration");
