import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ChatMessage, Conversation, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { BusinessClock } from '../clock/clock';
import { PrismaService } from '../prisma/prisma.service';
import { numericId } from '../seed/seed-data';
import { WebhookEmitter } from '../webhooks/webhook-emitter.service';

export type SenderRole = 'BUYER' | 'SHOP' | 'CUSTOMER_SERVICE';
export const SUPPORTED_MESSAGE_TYPES = ['TEXT'] as const;
export const MAX_TEXT_LENGTH = 2000;

export class ChatRuleError extends BadRequestException {
  constructor(readonly code: string, message: string) {
    super({ code, message });
  }
}

export interface PostOptions {
  requestId?: string;
  /** Test Console: store the message but emit NO event (a lost webhook). */
  suppressEvent?: boolean;
  /** Test Console: emit the very same event twice (same notification id), like a retried delivery. */
  duplicateEvent?: boolean;
}

/** TEXT content is a JSON-serialized string: {"content":"..."} (OAS: cs.send_message_202309). */
export function serializeText(text: string): string {
  return JSON.stringify({ content: text });
}
export function parseText(content: string): string | null {
  try {
    const v = JSON.parse(content) as { content?: unknown };
    return typeof v.content === 'string' ? v.content : null;
  } catch {
    return null;
  }
}
export function validateText(text: unknown): string {
  if (typeof text !== 'string' || text.trim().length === 0) throw new ChatRuleError('invalid_text', 'text is required');
  if (text.length > MAX_TEXT_LENGTH) throw new ChatRuleError('invalid_text', `text is limited to ${MAX_TEXT_LENGTH} characters`);
  return text;
}

/**
 * Conversation and message writes. A message, the conversation bump and its NEW_MESSAGE events are ONE transaction (transactional outbox):
 * a stored message always has its event unless the Test Console explicitly suppressed it, and an event never exists without its message.
 * Business timestamps use the business clock; ordering uses the immutable `index` (per conversation) and `seq`.
 */
@Injectable()
export class ChatService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BusinessClock) private readonly clock: BusinessClock,
    @Inject(WebhookEmitter) private readonly emitter: WebhookEmitter,
  ) {}

  /** The buyer's single open conversation with a shop; created on the first message. */
  async conversationForBuyer(shopId: string, buyerId: string): Promise<Conversation> {
    const existing = await this.prisma.conversation.findFirst({ where: { shopId, buyerId }, orderBy: { seq: 'asc' } });
    if (existing) return existing;
    const [shop, buyer] = await Promise.all([this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } }), this.prisma.buyer.findUniqueOrThrow({ where: { id: buyerId } })]);
    const id = randomUUID();
    const now = this.clock.now();
    try {
      return await this.prisma.conversation.create({
        data: {
          id,
          shopId,
          externalId: numericId('5900', `conversation:${id}`),
          buyerId,
          buyerUserId: buyer.externalId,
          buyerImUserId: numericId('5910', `im:${buyer.id}`), // IM id: different from user_id and useless for order queries
          buyerNickname: buyer.name,
          shopImUserId: numericId('5920', `im:shop:${shop.id}`),
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (e) {
      // two concurrent first messages: keep the winner (a buyer has one conversation per shop)
      const winner = await this.prisma.conversation.findFirst({ where: { shopId, buyerId }, orderBy: { seq: 'asc' } });
      if (winner) return winner;
      throw e;
    }
  }

  async postText(conversationId: string, role: SenderRole, text: string, opts: PostOptions = {}): Promise<{ message: ChatMessage; conversation: Conversation }> {
    validateText(text);
    return this.postRaw(conversationId, role, 'TEXT', serializeText(text), opts);
  }

  async postRaw(conversationId: string, role: SenderRole, type: string, content: string, opts: PostOptions = {}): Promise<{ message: ChatMessage; conversation: Conversation }> {
    return this.prisma.$transaction(async (tx) => {
      // atomically reserve the next index; the row lock serialises concurrent senders of one conversation
      const bumped = await tx.conversation.update({ where: { id: conversationId }, data: { nextIndex: { increment: 1 }, updatedAt: this.clock.now() } }).catch(() => null);
      if (!bumped) throw new NotFoundException('Unknown conversation');
      const index = bumped.nextIndex - 1;
      const now = this.clock.now();
      const shop = await tx.shop.findUniqueOrThrow({ where: { id: bumped.shopId } });
      const sender = role === 'BUYER' ? { imUserId: bumped.buyerImUserId, nickname: bumped.buyerNickname } : { imUserId: bumped.shopImUserId, nickname: shop.name };
      const id = randomUUID();
      const message = await tx.chatMessage.create({
        data: { id, conversationId, shopId: bumped.shopId, externalId: numericId('5800', `msg:${id}`), index, type, content, senderRole: role, senderImUserId: sender.imUserId, senderNickname: sender.nickname, createdAt: now },
      });
      if (!opts.suppressEvent) {
        const data = this.messageEventData(bumped, message);
        await this.emitter.emit(tx, shop, 'NEW_MESSAGE', data, opts.requestId);
        if (opts.duplicateEvent) await this.duplicateLastJobs(tx, shop.id, 'NEW_MESSAGE', data);
      }
      return { message, conversation: bumped };
    });
  }

  /** NEW_CONVERSATION fires when a customer-service agent joins or leaves (OAS event_type description). */
  async setAgent(conversationId: string, joined: boolean, requestId?: string): Promise<Conversation> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.conversation.findUnique({ where: { id: conversationId } });
      if (!current) throw new NotFoundException('Unknown conversation');
      const updated = await tx.conversation.update({ where: { id: conversationId }, data: { agentJoined: joined, updatedAt: this.clock.now() } });
      const shop = await tx.shop.findUniqueOrThrow({ where: { id: current.shopId } });
      await this.emitter.emit(tx, shop, 'NEW_CONVERSATION', { conversation_id: updated.externalId, event: joined ? 'AGENT_JOINED' : 'AGENT_LEFT', participant_count: joined ? 3 : 2, create_time: Math.floor(this.clock.now().getTime() / 1000) }, requestId);
      return updated;
    });
  }

  /** PROVISIONAL payload (the NEW_MESSAGE body is not verified in contracts/); fields mirror the Get Messages item. */
  messageEventData(c: Pick<Conversation, 'externalId'>, m: ChatMessage): Record<string, unknown> {
    return {
      conversation_id: c.externalId,
      message_id: m.externalId,
      index: String(m.index),
      type: m.type,
      content: m.content,
      sender: { role: m.senderRole, im_user_id: m.senderImUserId, nickname: m.senderNickname },
      is_visible: m.isVisible,
      create_time: Math.floor(m.createdAt.getTime() / 1000),
    };
  }

  /** Re-queue the newest jobs of a topic with the SAME envelope (same tts_notification_id), as a redelivery would. */
  private async duplicateLastJobs(tx: Prisma.TransactionClient, shopId: string, topic: string, data: Record<string, unknown>): Promise<void> {
    const jobs = await tx.webhookJob.findMany({ where: { shopId, topic, status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 20 });
    for (const j of jobs.filter((x) => (x.payload as { data?: { message_id?: unknown } }).data?.message_id === data.message_id && !x.replayOfId)) {
      await tx.webhookJob.create({ data: { shopId, appId: j.appId, topic, payload: j.payload as Prisma.InputJsonValue, targetUrl: j.targetUrl, requestId: j.requestId, replayOfId: j.id } });
    }
  }

  // ---- ownership ------------------------------------------------------------------------------------------------

  /** Conversation of this shop by marketplace id; another shop's id is indistinguishable from an unknown one. */
  async ownedByShop(shopId: string, externalId: string): Promise<Conversation | null> {
    return this.prisma.conversation.findUnique({ where: { shopId_externalId: { shopId, externalId } } });
  }

  async assertParticipant(p: { role: 'BUYER' | 'SELLER'; shopId: string; buyerId: string | null }, conversationRowId: string): Promise<Conversation> {
    const c = await this.prisma.conversation.findFirst({ where: { id: conversationRowId, shopId: p.shopId } });
    if (!c) throw new NotFoundException('Unknown conversation');
    if (p.role === 'BUYER' && c.buyerId !== p.buyerId) throw new ForbiddenException('This conversation belongs to another buyer');
    return c;
  }

  async unreadFor(c: Conversation): Promise<number> {
    const lastReply = await this.prisma.chatMessage.findFirst({ where: { conversationId: c.id, senderRole: { not: 'BUYER' } }, orderBy: { seq: 'desc' }, select: { seq: true } });
    return this.prisma.chatMessage.count({ where: { conversationId: c.id, senderRole: 'BUYER', seq: { gt: lastReply?.seq ?? 0 } } });
  }
}
