ALTER TABLE "copyable_messages" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "copyable_messages" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "copyable_messages_order_idx" ON "copyable_messages"("order");
CREATE INDEX "copyable_messages_status_idx" ON "copyable_messages"("status");
