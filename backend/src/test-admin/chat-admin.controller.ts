import { Body, CanActivate, Controller, ExecutionContext, Get, Inject, Injectable, NotFoundException, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { ChatService, validateText } from '../chat/chat.service';
import { createUnknownConversation } from '../chat/conversation-seed';
import { ZodPipe } from '../common/zod.pipe';
import { APP_CONFIG, AppConfig } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';

/** Same shared-secret check as TestAdminGuard (kept as a separate small class to avoid a circular import with test-admin.module.ts). */
@Injectable()
export class ChatAdminGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
  canActivate(ctx: ExecutionContext): boolean {
    const given = Buffer.from(ctx.switchToHttp().getRequest<Request>().header('x-test-admin-token') ?? '');
    const expected = Buffer.from(this.config.testAdminToken);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedException('Missing or invalid x-test-admin-token');
    return true;
  }
}

const BuyerMessage = z.object({
  text: z.string().min(1).max(2000),
  /** the message is stored but its NEW_MESSAGE event is lost */
  suppressEvent: z.boolean().optional(),
  /** the same event (same notification id) is delivered twice */
  duplicateEvent: z.boolean().optional(),
});
const ConversationFlags = z
  .object({ dropSendResponse: z.boolean(), canSendMessage: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
const AgentBody = z.object({ joined: z.boolean() });
const NewConversation = z.object({
  shopId: z.string().min(1),
  /** a TikTok identity that matches NO simulator buyer (the identity-mismatch scenario) */
  unknownBuyerNickname: z.string().min(1).max(100),
  text: z.string().min(1).max(2000),
});

/** Test Console controls for conversations (Phase 08). Never reachable from the TikTok router. */
@Controller()
@UseGuards(ChatAdminGuard)
export class ChatAdminController {
  constructor(
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get('chat/conversations')
  async list() {
    const rows = await this.prisma.conversation.findMany({ orderBy: { seq: 'asc' }, include: { shop: { select: { name: true } }, _count: { select: { messages: true } } } });
    return {
      items: rows.map((c) => ({
        id: c.externalId,
        rowId: c.id,
        shopId: c.shopId,
        shopName: c.shop.name,
        buyerNickname: c.buyerNickname,
        buyerUserId: c.buyerUserId,
        buyerImUserId: c.buyerImUserId,
        identityKnown: c.buyerId !== null,
        messages: c._count.messages,
        agentJoined: c.agentJoined,
        canSendMessage: c.canSendMessage,
        dropSendResponse: c.dropSendResponse,
        // TEST DATA label, not a classifier output
        complaintTestLabel: c.complaintTestLabel,
        updatedAt: c.updatedAt.toISOString(),
      })),
    };
  }

  /** Simulates a buyer message arriving, optionally with a lost or duplicated event. */
  @Post('chat/conversations/:ref/buyer-message')
  async buyerMessage(@Req() req: Request & { requestId?: string }, @Param('ref') ref: string, @Body(new ZodPipe(BuyerMessage)) body: z.infer<typeof BuyerMessage>) {
    const c = await this.find(ref);
    validateText(body.text);
    const { message } = await this.chat.postText(c.id, 'BUYER', body.text, { requestId: req.requestId, suppressEvent: body.suppressEvent, duplicateEvent: body.duplicateEvent });
    return { messageId: message.externalId, index: message.index, eventSuppressed: !!body.suppressEvent, eventDuplicated: !!body.duplicateEvent };
  }

  @Post('chat/conversations/:ref/flags')
  async flags(@Param('ref') ref: string, @Body(new ZodPipe(ConversationFlags)) body: z.infer<typeof ConversationFlags>) {
    const c = await this.find(ref);
    const u = await this.prisma.conversation.update({ where: { id: c.id }, data: body });
    return { id: u.externalId, dropSendResponse: u.dropSendResponse, canSendMessage: u.canSendMessage };
  }

  /** NEW_CONVERSATION fires when a customer-service agent joins or leaves. */
  @Post('chat/conversations/:ref/agent')
  async agent(@Req() req: Request & { requestId?: string }, @Param('ref') ref: string, @Body(new ZodPipe(AgentBody)) body: z.infer<typeof AgentBody>) {
    const c = await this.find(ref);
    const u = await this.chat.setAgent(c.id, body.joined, req.requestId);
    return { id: u.externalId, agentJoined: u.agentJoined };
  }

  /** A conversation from a TikTok user the simulator cannot link to any buyer/order (identity mismatch). */
  @Post('chat/conversations')
  async createUnknown(@Req() req: Request & { requestId?: string }, @Body(new ZodPipe(NewConversation)) body: z.infer<typeof NewConversation>) {
    const shop = await this.prisma.shop.findUnique({ where: { id: body.shopId } });
    if (!shop) throw new NotFoundException('Unknown shop');
    const c = await createUnknownConversation(this.prisma, shop, body.unknownBuyerNickname);
    const { message } = await this.chat.postText(c.id, 'BUYER', body.text, { requestId: req.requestId });
    return { id: c.externalId, buyerUserId: c.buyerUserId, identityKnown: false, messageId: message.externalId };
  }

  private async find(ref: string) {
    const rows = await this.prisma.conversation.findMany({ where: { OR: [{ id: ref }, { externalId: ref }] } });
    if (rows.length === 0) throw new NotFoundException('Unknown conversation');
    if (rows.length > 1) throw new NotFoundException('Conversation id is ambiguous; use the row id');
    return rows[0];
  }
}
