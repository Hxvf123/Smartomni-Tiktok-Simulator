-- CreateTable
CREATE TABLE "AftersaleRequest" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "rejectReason" TEXT,
    "rejectComment" TEXT,
    "returnTrackingNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "refundSubtotal" INTEGER NOT NULL,
    "refundShipping" INTEGER NOT NULL DEFAULT 0,
    "refundTotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AftersaleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AftersaleLine" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "refundSubtotal" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AftersaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AftersaleRecord" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AftersaleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AftersaleRequest_seq_key" ON "AftersaleRequest"("seq");

-- CreateIndex
CREATE INDEX "AftersaleRequest_shopId_seq_idx" ON "AftersaleRequest"("shopId", "seq");

-- CreateIndex
CREATE INDEX "AftersaleRequest_orderId_idx" ON "AftersaleRequest"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "AftersaleRequest_shopId_externalId_key" ON "AftersaleRequest"("shopId", "externalId");

-- CreateIndex
CREATE INDEX "AftersaleLine_requestId_idx" ON "AftersaleLine"("requestId");

-- CreateIndex
CREATE INDEX "AftersaleLine_orderLineId_idx" ON "AftersaleLine"("orderLineId");

-- CreateIndex
CREATE INDEX "AftersaleRecord_requestId_createdAt_idx" ON "AftersaleRecord"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AftersaleRecord_requestId_idempotencyKey_key" ON "AftersaleRecord"("requestId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "AftersaleRequest" ADD CONSTRAINT "AftersaleRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AftersaleRequest" ADD CONSTRAINT "AftersaleRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AftersaleLine" ADD CONSTRAINT "AftersaleLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AftersaleRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AftersaleLine" ADD CONSTRAINT "AftersaleLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AftersaleRecord" ADD CONSTRAINT "AftersaleRecord_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AftersaleRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A unit (order line) can be held by at most ONE active aftersale request: enforced by the database, not by a prior check.
CREATE UNIQUE INDEX "AftersaleLine_orderLineId_active_key" ON "AftersaleLine"("orderLineId") WHERE "active";
