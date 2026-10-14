import { Conversation, PrismaClient, Shop } from '@prisma/client';
import { randomUUID } from 'crypto';
import { detId, numericId } from '../seed/seed-data';
import { serializeText } from './chat.service';

/** Fixed past date so seeded history is deterministic and clearly older than any connection made during a test. */
const HISTORY = new Date('2026-10-12T03:00:00.000Z');
const at = (minutes: number): Date => new Date(HISTORY.getTime() + minutes * 60_000);

interface SeedMessage {
  role: 'BUYER' | 'SHOP' | 'SYSTEM';
  text: string;
  type?: string;
  visible?: boolean;
}
interface SeedConversation {
  key: string;
  buyerCode: string | null; // null = identity mismatch (TikTok user unknown to the simulator)
  nickname?: string;
  complaintTestLabel?: boolean;
  messages: SeedMessage[];
}

/**
 * TEST CONVERSATIONS only. `complaintTestLabel` marks which conversation to use for complaint-flow tests; it is a data label, NOT a classifier
 * result, and the TikTok API never returns it. Seeded history exists BEFORE any connection so that "sync only from the connection time" is testable.
 */
const SEEDS: Record<string, SeedConversation[]> = {
  a: [
    { key: 'a-history', buyerCode: 'a-1', messages: [{ role: 'BUYER', text: 'Áo thun này có size XL không?' }, { role: 'SHOP', text: 'Dạ shop có size XL ạ.' }] },
    {
      key: 'a-complaint',
      buyerCode: 'a-2',
      complaintTestLabel: true,
      messages: [
        { role: 'BUYER', text: 'Hàng tôi nhận được bị lỗi, tôi rất không hài lòng và muốn hoàn tiền ngay.' },
        { role: 'SYSTEM', type: 'NOTIFICATION', text: 'rating request', visible: false },
      ],
    },
    { key: 'a-unknown', buyerCode: null, nickname: 'tiktok_user_unlinked', messages: [{ role: 'BUYER', text: 'Cho mình hỏi về đơn hàng của mình với.' }] },
  ],
  b: [
    { key: 'b-history', buyerCode: 'b-1', messages: [{ role: 'BUYER', text: 'Cốc này có hộp quà không ạ?' }, { role: 'SHOP', text: 'Có hộp quà miễn phí ạ.' }] },
    { key: 'b-unknown', buyerCode: null, nickname: 'tiktok_user_unlinked_b', messages: [{ role: 'BUYER', text: 'Shop ơi còn hàng không?' }] },
  ],
};

export async function seedConversations(prisma: PrismaClient, shop: Shop, shopKey: string): Promise<void> {
  for (const def of SEEDS[shopKey] ?? []) {
    const buyer = def.buyerCode ? await prisma.buyer.findUnique({ where: { externalId: `sim-buyer-${def.buyerCode}` } }) : null;
    if (def.buyerCode && !buyer) continue;
    const id = detId(`conversation:${def.key}`);
    if (await prisma.conversation.findUnique({ where: { id } })) continue; // idempotent: never rewrite history
    const imBase = def.buyerCode ?? def.key;
    await prisma.conversation.create({
      data: {
        id,
        shopId: shop.id,
        externalId: numericId('5900', `conversation:${def.key}`),
        buyerId: buyer?.id ?? null,
        buyerUserId: buyer?.externalId ?? `tt-unknown-${def.key}`,
        buyerImUserId: numericId('5910', `im:${imBase}`),
        buyerNickname: buyer?.name ?? def.nickname ?? 'tiktok user',
        shopImUserId: numericId('5920', `im:shop:${shop.id}`),
        complaintTestLabel: def.complaintTestLabel ?? false,
        createdAt: at(0),
        updatedAt: at(def.messages.length),
        nextIndex: def.messages.length + 1,
        messages: {
          create: def.messages.map((m, i) => ({
            id: detId(`chatmsg:${def.key}:${i}`),
            shopId: shop.id,
            externalId: numericId('5800', `chatmsg:${def.key}:${i}`),
            index: i + 1,
            type: m.type ?? 'TEXT',
            content: serializeText(m.text),
            senderRole: m.role,
            senderImUserId: m.role === 'BUYER' ? numericId('5910', `im:${imBase}`) : numericId('5920', `im:shop:${shop.id}`),
            senderNickname: m.role === 'BUYER' ? (buyer?.name ?? def.nickname ?? 'tiktok user') : shop.name,
            isVisible: m.visible ?? true,
            createdAt: at(i + 1),
          })),
        },
      },
    });
  }
}

/** Used by the Test Console: a conversation whose TikTok user matches no simulator buyer. */
export async function createUnknownConversation(prisma: PrismaClient, shop: Shop, nickname: string): Promise<Conversation> {
  const id = randomUUID();
  const now = new Date();
  return prisma.conversation.create({
    data: {
      id,
      shopId: shop.id,
      externalId: numericId('5900', `conversation:${id}`),
      buyerId: null,
      buyerUserId: `tt-unknown-${id.slice(0, 8)}`,
      buyerImUserId: numericId('5910', `im:${id}`),
      buyerNickname: nickname,
      shopImUserId: numericId('5920', `im:shop:${shop.id}`),
      createdAt: now,
      updatedAt: now,
    },
  });
}
