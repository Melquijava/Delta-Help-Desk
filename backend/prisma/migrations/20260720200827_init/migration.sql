-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProcedureStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProcedureDifficulty" AS ENUM ('EASY', 'MEDIUM', 'ADVANCED');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('INFORMATION', 'QUESTION', 'ACTION', 'COPYABLE_MESSAGE', 'ALERT', 'CHECK', 'FINAL_SOLUTION', 'TECHNICAL_ESCALATION');

-- CreateEnum
CREATE TYPE "UsageStatus" AS ENUM ('IN_PROGRESS', 'RESOLVED', 'NOT_RESOLVED', 'ESCALATED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'PUBLISH', 'ARCHIVE', 'DUPLICATE', 'LOGIN', 'LOGOUT', 'COPY_MESSAGE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedures" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" "ProcedureDifficulty" NOT NULL DEFAULT 'EASY',
    "estimatedMinutes" INTEGER,
    "status" "ProcedureStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "initialStepId" TEXT,
    "authorId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_steps" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "type" "StepType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "nextStepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "procedure_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_options" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "nextStepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "step_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copyable_messages" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "copyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "copyable_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_usages" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "attendantId" TEXT NOT NULL,
    "status" "UsageStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStepId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedure_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_usage_steps" (
    "id" TEXT NOT NULL,
    "usageId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "order" INTEGER NOT NULL,
    "notes" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedure_usage_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copied_message_logs" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "usageId" TEXT,
    "userId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "copiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copied_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_feedbacks" (
    "id" TEXT NOT NULL,
    "usageId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wasResolved" BOOLEAN NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedure_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_procedures" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "favorite_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "selectedProcedureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "procedureId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");

-- CreateIndex
CREATE INDEX "roles_status_idx" ON "roles"("status");

-- CreateIndex
CREATE INDEX "roles_deletedAt_idx" ON "roles"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "permissions_action_idx" ON "permissions"("action");

-- CreateIndex
CREATE INDEX "permissions_deletedAt_idx" ON "permissions"("deletedAt");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE INDEX "user_roles_deletedAt_idx" ON "user_roles"("deletedAt");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE INDEX "role_permissions_deletedAt_idx" ON "role_permissions"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_revokedAt_idx" ON "refresh_tokens"("revokedAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_deletedAt_idx" ON "refresh_tokens"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_status_idx" ON "categories"("status");

-- CreateIndex
CREATE INDEX "categories_order_idx" ON "categories"("order");

-- CreateIndex
CREATE INDEX "categories_deletedAt_idx" ON "categories"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "procedures_slug_key" ON "procedures"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "procedures_initialStepId_key" ON "procedures"("initialStepId");

-- CreateIndex
CREATE INDEX "procedures_categoryId_idx" ON "procedures"("categoryId");

-- CreateIndex
CREATE INDEX "procedures_authorId_idx" ON "procedures"("authorId");

-- CreateIndex
CREATE INDEX "procedures_status_idx" ON "procedures"("status");

-- CreateIndex
CREATE INDEX "procedures_difficulty_idx" ON "procedures"("difficulty");

-- CreateIndex
CREATE INDEX "procedures_featured_idx" ON "procedures"("featured");

-- CreateIndex
CREATE INDEX "procedures_publishedAt_idx" ON "procedures"("publishedAt");

-- CreateIndex
CREATE INDEX "procedures_deletedAt_idx" ON "procedures"("deletedAt");

-- CreateIndex
CREATE INDEX "procedure_steps_procedureId_idx" ON "procedure_steps"("procedureId");

-- CreateIndex
CREATE INDEX "procedure_steps_type_idx" ON "procedure_steps"("type");

-- CreateIndex
CREATE INDEX "procedure_steps_position_idx" ON "procedure_steps"("position");

-- CreateIndex
CREATE INDEX "procedure_steps_nextStepId_idx" ON "procedure_steps"("nextStepId");

-- CreateIndex
CREATE INDEX "procedure_steps_deletedAt_idx" ON "procedure_steps"("deletedAt");

-- CreateIndex
CREATE INDEX "step_options_stepId_idx" ON "step_options"("stepId");

-- CreateIndex
CREATE INDEX "step_options_nextStepId_idx" ON "step_options"("nextStepId");

-- CreateIndex
CREATE INDEX "step_options_order_idx" ON "step_options"("order");

-- CreateIndex
CREATE INDEX "step_options_deletedAt_idx" ON "step_options"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "step_options_stepId_value_key" ON "step_options"("stepId", "value");

-- CreateIndex
CREATE INDEX "copyable_messages_procedureId_idx" ON "copyable_messages"("procedureId");

-- CreateIndex
CREATE INDEX "copyable_messages_stepId_idx" ON "copyable_messages"("stepId");

-- CreateIndex
CREATE INDEX "copyable_messages_copyCount_idx" ON "copyable_messages"("copyCount");

-- CreateIndex
CREATE INDEX "copyable_messages_deletedAt_idx" ON "copyable_messages"("deletedAt");

-- CreateIndex
CREATE INDEX "procedure_usages_procedureId_idx" ON "procedure_usages"("procedureId");

-- CreateIndex
CREATE INDEX "procedure_usages_attendantId_idx" ON "procedure_usages"("attendantId");

-- CreateIndex
CREATE INDEX "procedure_usages_status_idx" ON "procedure_usages"("status");

-- CreateIndex
CREATE INDEX "procedure_usages_currentStepId_idx" ON "procedure_usages"("currentStepId");

-- CreateIndex
CREATE INDEX "procedure_usages_startedAt_idx" ON "procedure_usages"("startedAt");

-- CreateIndex
CREATE INDEX "procedure_usages_completedAt_idx" ON "procedure_usages"("completedAt");

-- CreateIndex
CREATE INDEX "procedure_usage_steps_usageId_idx" ON "procedure_usage_steps"("usageId");

-- CreateIndex
CREATE INDEX "procedure_usage_steps_stepId_idx" ON "procedure_usage_steps"("stepId");

-- CreateIndex
CREATE INDEX "procedure_usage_steps_selectedOptionId_idx" ON "procedure_usage_steps"("selectedOptionId");

-- CreateIndex
CREATE INDEX "procedure_usage_steps_enteredAt_idx" ON "procedure_usage_steps"("enteredAt");

-- CreateIndex
CREATE UNIQUE INDEX "procedure_usage_steps_usageId_order_key" ON "procedure_usage_steps"("usageId", "order");

-- CreateIndex
CREATE INDEX "copied_message_logs_messageId_idx" ON "copied_message_logs"("messageId");

-- CreateIndex
CREATE INDEX "copied_message_logs_usageId_idx" ON "copied_message_logs"("usageId");

-- CreateIndex
CREATE INDEX "copied_message_logs_userId_idx" ON "copied_message_logs"("userId");

-- CreateIndex
CREATE INDEX "copied_message_logs_procedureId_idx" ON "copied_message_logs"("procedureId");

-- CreateIndex
CREATE INDEX "copied_message_logs_copiedAt_idx" ON "copied_message_logs"("copiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "procedure_feedbacks_usageId_key" ON "procedure_feedbacks"("usageId");

-- CreateIndex
CREATE INDEX "procedure_feedbacks_procedureId_idx" ON "procedure_feedbacks"("procedureId");

-- CreateIndex
CREATE INDEX "procedure_feedbacks_userId_idx" ON "procedure_feedbacks"("userId");

-- CreateIndex
CREATE INDEX "procedure_feedbacks_wasResolved_idx" ON "procedure_feedbacks"("wasResolved");

-- CreateIndex
CREATE INDEX "procedure_feedbacks_createdAt_idx" ON "procedure_feedbacks"("createdAt");

-- CreateIndex
CREATE INDEX "favorite_procedures_procedureId_idx" ON "favorite_procedures"("procedureId");

-- CreateIndex
CREATE INDEX "favorite_procedures_deletedAt_idx" ON "favorite_procedures"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_procedures_userId_procedureId_key" ON "favorite_procedures"("userId", "procedureId");

-- CreateIndex
CREATE INDEX "search_logs_userId_idx" ON "search_logs"("userId");

-- CreateIndex
CREATE INDEX "search_logs_normalizedQuery_idx" ON "search_logs"("normalizedQuery");

-- CreateIndex
CREATE INDEX "search_logs_selectedProcedureId_idx" ON "search_logs"("selectedProcedureId");

-- CreateIndex
CREATE INDEX "search_logs_createdAt_idx" ON "search_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs"("entityType");

-- CreateIndex
CREATE INDEX "audit_logs_entityId_idx" ON "audit_logs"("entityId");

-- CreateIndex
CREATE INDEX "audit_logs_procedureId_idx" ON "audit_logs"("procedureId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_isPublic_idx" ON "system_settings"("isPublic");

-- CreateIndex
CREATE INDEX "system_settings_updatedById_idx" ON "system_settings"("updatedById");

-- CreateIndex
CREATE INDEX "system_settings_deletedAt_idx" ON "system_settings"("deletedAt");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_initialStepId_fkey" FOREIGN KEY ("initialStepId") REFERENCES "procedure_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_steps" ADD CONSTRAINT "procedure_steps_nextStepId_fkey" FOREIGN KEY ("nextStepId") REFERENCES "procedure_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_steps" ADD CONSTRAINT "procedure_steps_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_options" ADD CONSTRAINT "step_options_nextStepId_fkey" FOREIGN KEY ("nextStepId") REFERENCES "procedure_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_options" ADD CONSTRAINT "step_options_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "procedure_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copyable_messages" ADD CONSTRAINT "copyable_messages_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copyable_messages" ADD CONSTRAINT "copyable_messages_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "procedure_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_usages" ADD CONSTRAINT "procedure_usages_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_usages" ADD CONSTRAINT "procedure_usages_currentStepId_fkey" FOREIGN KEY ("currentStepId") REFERENCES "procedure_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_usages" ADD CONSTRAINT "procedure_usages_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_usage_steps" ADD CONSTRAINT "procedure_usage_steps_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "step_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_usage_steps" ADD CONSTRAINT "procedure_usage_steps_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "procedure_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_usage_steps" ADD CONSTRAINT "procedure_usage_steps_usageId_fkey" FOREIGN KEY ("usageId") REFERENCES "procedure_usages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copied_message_logs" ADD CONSTRAINT "copied_message_logs_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "copyable_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copied_message_logs" ADD CONSTRAINT "copied_message_logs_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copied_message_logs" ADD CONSTRAINT "copied_message_logs_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "procedure_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copied_message_logs" ADD CONSTRAINT "copied_message_logs_usageId_fkey" FOREIGN KEY ("usageId") REFERENCES "procedure_usages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copied_message_logs" ADD CONSTRAINT "copied_message_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_feedbacks" ADD CONSTRAINT "procedure_feedbacks_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_feedbacks" ADD CONSTRAINT "procedure_feedbacks_usageId_fkey" FOREIGN KEY ("usageId") REFERENCES "procedure_usages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_feedbacks" ADD CONSTRAINT "procedure_feedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_procedures" ADD CONSTRAINT "favorite_procedures_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_procedures" ADD CONSTRAINT "favorite_procedures_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_selectedProcedureId_fkey" FOREIGN KEY ("selectedProcedureId") REFERENCES "procedures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
