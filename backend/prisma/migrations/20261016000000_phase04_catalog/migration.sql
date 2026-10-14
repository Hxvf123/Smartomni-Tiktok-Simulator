-- Phase 04: catalog. Ids become unique PER SHOP, seller SKU may repeat, warehouses get a TikTok-style external id.

-- Warehouse
ALTER TABLE "Warehouse" ADD COLUMN "externalId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Warehouse" ADD COLUMN "effectStatus" TEXT NOT NULL DEFAULT 'ENABLED';
-- Backfill: deterministic numeric-looking id, distinct per row (prefix 7600 + 15 digits from the row id hash).
UPDATE "Warehouse" SET "externalId" = '7600' || lpad((('x' || substr(md5("id"), 1, 12))::bit(48)::bigint % 1000000000000000)::text, 15, '0') WHERE "externalId" = '';
CREATE UNIQUE INDEX "Warehouse_shopId_externalId_key" ON "Warehouse"("shopId", "externalId");

-- Product: external id unique per shop; status values follow the OAS (ACTIVE -> ACTIVATE).
DROP INDEX "Product_externalId_key";
ALTER TABLE "Product" ADD COLUMN "isNotForSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ALTER COLUMN "status" SET DEFAULT 'ACTIVATE';
UPDATE "Product" SET "status" = 'ACTIVATE' WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "Product_shopId_externalId_key" ON "Product"("shopId", "externalId");
DROP INDEX IF EXISTS "Product_shopId_idx";
ALTER TABLE "Product" ADD COLUMN "seq" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Product_seq_key" ON "Product"("seq");
CREATE INDEX "Product_shopId_seq_idx" ON "Product"("shopId", "seq");

-- Sku: external id unique per shop; seller SKU no longer unique.
DROP INDEX "Sku_externalId_key";
DROP INDEX "Sku_shopId_sellerSku_key";
ALTER TABLE "Sku" ADD COLUMN "attributeName" TEXT NOT NULL DEFAULT 'Phân loại';
ALTER TABLE "Sku" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'NORMAL';
CREATE UNIQUE INDEX "Sku_shopId_externalId_key" ON "Sku"("shopId", "externalId");
CREATE INDEX "Sku_shopId_sellerSku_idx" ON "Sku"("shopId", "sellerSku");
