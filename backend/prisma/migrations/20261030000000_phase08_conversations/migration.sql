-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "buyerId" TEXT,
    "buyerUserId" TEXT NOT NULL,
    "buyerImUserId" TEXT NOT NULL,
    "buyerNickname" TEXT NOT NULL,
    "shopImUserId" TEXT NOT NULL,
    "agentJoined" BOOLEAN NOT NULL DEFAULT false,
    "canSendMessage" BOOLEAN NOT NULL DEFAULT true,
    "complaintTestLabel" BOOLEAN NOT NULL DEFAULT false,
    "dropSendResponse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nextIndex" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "index" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "senderImUserId" TEXT NOT NULL,
    "senderNickname" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_seq_key" ON "Conversation"("seq");

-- CreateIndex
CREATE INDEX "Conversation_shopId_seq_idx" ON "Conversation"("shopId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_shopId_externalId_key" ON "Conversation"("shopId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_seq_key" ON "ChatMessage"("seq");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_seq_idx" ON "ChatMessage"("conversationId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_shopId_externalId_key" ON "ChatMessage"("shopId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_conversationId_index_key" ON "ChatMessage"("conversationId", "index");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

