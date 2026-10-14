-- CreateEnum
CREATE TYPE "ShopStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WebhookJobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'DEAD');

-- CreateEnum
CREATE TYPE "WebhookAttemptStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'LEASE_EXPIRED');

-- CreateEnum
CREATE TYPE "DemoRole" AS ENUM ('SELLER', 'BUYER');

-- CreateEnum
CREATE TYPE "FaultTarget" AS ENUM ('API', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "FaultKind" AS ENUM ('HTTP_ERROR', 'DELAY', 'DROP', 'DUPLICATE');

-- CreateTable
CREATE TABLE "Seller" (
    "id" TEXT NOT NULL,
    "openId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "tiktokShopId" TEXT NOT NULL,
    "shopCipher" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'VN',
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "ShopStatus" NOT NULL DEFAULT 'ACTIVE',
    "sellerId" TEXT NOT NULL,
    "activeScenarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL,
    "appKey" TEXT NOT NULL,
    "appSecret" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sku" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sellerSku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceVnd" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLevel" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "DemoRole" NOT NULL,
    "shopId" TEXT NOT NULL,
    "buyerId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HttpRequestLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "router" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "query" JSONB,
    "requestHeaders" JSONB,
    "requestBody" TEXT,
    "responseStatus" INTEGER NOT NULL,
    "responseHeaders" JSONB,
    "responseBody" TEXT,
    "durationMs" INTEGER NOT NULL,
    "shopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HttpRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookJob" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "requestId" TEXT,
    "status" "WebhookJobStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" TEXT,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "replayOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "workerId" TEXT NOT NULL,
    "leaseToken" TEXT NOT NULL,
    "status" "WebhookAttemptStatus" NOT NULL DEFAULT 'STARTED',
    "possibleDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "lateCompletion" BOOLEAN NOT NULL DEFAULT false,
    "deliveries" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "httpStatus" INTEGER,
    "error" TEXT,
    "responseExcerpt" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "WebhookAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaultRule" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "target" "FaultTarget" NOT NULL,
    "kind" "FaultKind" NOT NULL,
    "pathMatch" TEXT,
    "params" JSONB NOT NULL DEFAULT '{}',
    "remaining" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaultRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClockState" (
    "id" INTEGER NOT NULL,
    "offsetMs" BIGINT NOT NULL DEFAULT 0,
    "frozenAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClockState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Seller_openId_key" ON "Seller"("openId");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_email_key" ON "Seller"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_tiktokShopId_key" ON "Shop"("tiktokShopId");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopCipher_key" ON "Shop"("shopCipher");

-- CreateIndex
CREATE INDEX "Shop_sellerId_idx" ON "Shop"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_externalId_key" ON "Buyer"("externalId");

-- CreateIndex
CREATE INDEX "Buyer_shopId_idx" ON "Buyer"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "App_appKey_key" ON "App"("appKey");

-- CreateIndex
CREATE UNIQUE INDEX "Token_accessTokenHash_key" ON "Token"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Token_refreshTokenHash_key" ON "Token"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Token_shopId_idx" ON "Token"("shopId");

-- CreateIndex
CREATE INDEX "Token_appId_idx" ON "Token"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_shopId_code_key" ON "Warehouse"("shopId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_externalId_key" ON "Product"("externalId");

-- CreateIndex
CREATE INDEX "Product_shopId_idx" ON "Product"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_externalId_key" ON "Sku"("externalId");

-- CreateIndex
CREATE INDEX "Sku_productId_idx" ON "Sku"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_shopId_sellerSku_key" ON "Sku"("shopId", "sellerSku");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLevel_skuId_warehouseId_key" ON "InventoryLevel"("skuId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Scenario_shopId_key_key" ON "Scenario"("shopId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "DemoSession_tokenHash_key" ON "DemoSession"("tokenHash");

-- CreateIndex
CREATE INDEX "DemoSession_shopId_idx" ON "DemoSession"("shopId");

-- CreateIndex
CREATE INDEX "HttpRequestLog_requestId_idx" ON "HttpRequestLog"("requestId");

-- CreateIndex
CREATE INDEX "HttpRequestLog_createdAt_idx" ON "HttpRequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "HttpRequestLog_shopId_createdAt_idx" ON "HttpRequestLog"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookJob_status_nextAttemptAt_idx" ON "WebhookJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WebhookJob_status_leaseExpiresAt_idx" ON "WebhookJob"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "WebhookJob_shopId_createdAt_idx" ON "WebhookJob"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookJob_requestId_idx" ON "WebhookJob"("requestId");

-- CreateIndex
CREATE INDEX "WebhookAttempt_jobId_idx" ON "WebhookAttempt"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookAttempt_jobId_attemptNo_key" ON "WebhookAttempt"("jobId", "attemptNo");

-- CreateIndex
CREATE INDEX "FaultRule_target_shopId_idx" ON "FaultRule"("target", "shopId");

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoSession" ADD CONSTRAINT "DemoSession_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoSession" ADD CONSTRAINT "DemoSession_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookJob" ADD CONSTRAINT "WebhookJob_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookJob" ADD CONSTRAINT "WebhookJob_replayOfId_fkey" FOREIGN KEY ("replayOfId") REFERENCES "WebhookJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookAttempt" ADD CONSTRAINT "WebhookAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "WebhookJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaultRule" ADD CONSTRAINT "FaultRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

