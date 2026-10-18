CREATE TYPE "MaintenanceCadence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "MaintenanceTaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');
CREATE TYPE "StockReason" AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT', 'WORK_ORDER');

-- AlterTable
ALTER TABLE "faults" ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN "closedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "faults_tenantId_closedAt_idx" ON "faults"("tenantId", "closedAt");

-- CreateTable
CREATE TABLE "maintenance_plans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cadence" "MaintenanceCadence" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "maintenance_plan_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "maintenance_plan_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "maintenance_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "MaintenanceTaskStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "assigneeId" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "maintenance_check_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "maintenance_check_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_balances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" "StockReason" NOT NULL,
    "delta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "workOrderId" TEXT,
    "operationId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_order_part_uses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_part_uses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "maintenance_plans_tenantId_nextDueAt_idx" ON "maintenance_plans"("tenantId", "nextDueAt");
CREATE INDEX "maintenance_plans_tenantId_equipmentId_idx" ON "maintenance_plans"("tenantId", "equipmentId");
CREATE INDEX "maintenance_plan_items_planId_sortOrder_idx" ON "maintenance_plan_items"("planId", "sortOrder");
CREATE INDEX "maintenance_tasks_tenantId_status_dueAt_idx" ON "maintenance_tasks"("tenantId", "status", "dueAt");
CREATE INDEX "maintenance_tasks_tenantId_equipmentId_status_idx" ON "maintenance_tasks"("tenantId", "equipmentId", "status");
CREATE INDEX "maintenance_tasks_tenantId_planId_status_idx" ON "maintenance_tasks"("tenantId", "planId", "status");
CREATE INDEX "maintenance_check_items_taskId_sortOrder_idx" ON "maintenance_check_items"("taskId", "sortOrder");
CREATE UNIQUE INDEX "parts_tenantId_code_key" ON "parts"("tenantId", "code");
CREATE INDEX "parts_tenantId_name_idx" ON "parts"("tenantId", "name");
CREATE UNIQUE INDEX "stock_balances_partId_key" ON "stock_balances"("partId");
CREATE UNIQUE INDEX "stock_balances_tenantId_partId_key" ON "stock_balances"("tenantId", "partId");
CREATE UNIQUE INDEX "stock_movements_tenantId_operationId_key" ON "stock_movements"("tenantId", "operationId");
CREATE INDEX "stock_movements_tenantId_partId_createdAt_idx" ON "stock_movements"("tenantId", "partId", "createdAt");
CREATE INDEX "stock_movements_tenantId_createdAt_idx" ON "stock_movements"("tenantId", "createdAt");
CREATE UNIQUE INDEX "work_order_part_uses_movementId_key" ON "work_order_part_uses"("movementId");
CREATE INDEX "work_order_part_uses_tenantId_workOrderId_idx" ON "work_order_part_uses"("tenantId", "workOrderId");
CREATE INDEX "attachments_tenantId_entityType_entityId_idx" ON "attachments"("tenantId", "entityType", "entityId");

ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_plan_items" ADD CONSTRAINT "maintenance_plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "maintenance_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_planId_fkey" FOREIGN KEY ("planId") REFERENCES "maintenance_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_check_items" ADD CONSTRAINT "maintenance_check_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parts" ADD CONSTRAINT "parts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_order_part_uses" ADD CONSTRAINT "work_order_part_uses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_order_part_uses" ADD CONSTRAINT "work_order_part_uses_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_order_part_uses" ADD CONSTRAINT "work_order_part_uses_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_order_part_uses" ADD CONSTRAINT "work_order_part_uses_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "stock_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
