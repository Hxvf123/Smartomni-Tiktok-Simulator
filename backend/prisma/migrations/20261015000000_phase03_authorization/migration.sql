-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "code" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sellerType" TEXT NOT NULL DEFAULT 'LOCAL';

-- CreateTable
CREATE TABLE "AuthorizationCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "state" TEXT,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationCode_codeHash_key" ON "AuthorizationCode"("codeHash");

-- CreateIndex
CREATE INDEX "AuthorizationCode_shopId_idx" ON "AuthorizationCode"("shopId");

-- CreateIndex
CREATE INDEX "AuthorizationCode_appId_idx" ON "AuthorizationCode"("appId");

-- AddForeignKey
ALTER TABLE "AuthorizationCode" ADD CONSTRAINT "AuthorizationCode_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationCode" ADD CONSTRAINT "AuthorizationCode_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill the simulator-generated shop code for rows created before this migration (same rule as the seed).
UPDATE "Shop" SET "code" = 'SIMVN' || right("tiktokShopId", 4) WHERE "code" = '';
