-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FaultKind" ADD VALUE 'TIMEOUT_BEFORE_WRITE';
ALTER TYPE "FaultKind" ADD VALUE 'TIMEOUT_AFTER_WRITE';
ALTER TYPE "FaultKind" ADD VALUE 'APP_ERROR_200';

-- CreateTable
CREATE TABLE "InventoryChange" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "shopId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "before" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "noop" BOOLEAN NOT NULL DEFAULT false,
    "requestId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryUpdateAttempt" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestId" TEXT,
    "outcome" TEXT NOT NULL,
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,
    "itemsApplied" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryUpdateAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryChange_seq_key" ON "InventoryChange"("seq");

-- CreateIndex
CREATE INDEX "InventoryChange_shopId_seq_idx" ON "InventoryChange"("shopId", "seq");

-- CreateIndex
CREATE INDEX "InventoryChange_skuId_warehouseId_seq_idx" ON "InventoryChange"("skuId", "warehouseId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryUpdateAttempt_seq_key" ON "InventoryUpdateAttempt"("seq");

-- CreateIndex
CREATE INDEX "InventoryUpdateAttempt_shopId_seq_idx" ON "InventoryUpdateAttempt"("shopId", "seq");

-- AddForeignKey
ALTER TABLE "InventoryChange" ADD CONSTRAINT "InventoryChange_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryChange" ADD CONSTRAINT "InventoryChange_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

