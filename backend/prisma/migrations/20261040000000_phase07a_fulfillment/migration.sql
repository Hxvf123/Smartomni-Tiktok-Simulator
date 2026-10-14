-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "shippingProviderId" TEXT NOT NULL,
    "shippingProviderName" TEXT NOT NULL,
    "handoverMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageLine" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,

    CONSTRAINT "PackageLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "seq" SERIAL NOT NULL,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingDocument" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Package_orderId_key" ON "Package"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Package_shopId_externalId_key" ON "Package"("shopId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageLine_orderLineId_key" ON "PackageLine"("orderLineId");

-- CreateIndex
CREATE INDEX "TrackingEvent_orderId_at_seq_idx" ON "TrackingEvent"("orderId", "at", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingDocument_token_key" ON "ShippingDocument"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingDocument_packageId_docType_key" ON "ShippingDocument"("packageId", "docType");

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageLine" ADD CONSTRAINT "PackageLine_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingDocument" ADD CONSTRAINT "ShippingDocument_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

