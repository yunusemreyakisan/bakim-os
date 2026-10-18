-- CreateEnum
CREATE TYPE "SyncOpType" AS ENUM ('FAULT_CREATE');

-- CreateEnum
CREATE TYPE "SyncOpStatus" AS ENUM ('APPLIED', 'DUPLICATE', 'REJECTED', 'CONFLICT');

-- CreateTable
CREATE TABLE "sync_operations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "type" "SyncOpType" NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "SyncOpStatus" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "resultCode" TEXT,
    "resultMessage" TEXT,
    "clientCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_operations_tenantId_userId_createdAt_idx" ON "sync_operations"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sync_operations_tenantId_operationId_key" ON "sync_operations"("tenantId", "operationId");

-- AddForeignKey
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

