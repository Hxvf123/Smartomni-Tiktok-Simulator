import { ChatMessage, Conversation } from '@prisma/client';

const secs = (d: Date): number => Math.floor(d.getTime() / 1000);

type ConversationBuyer = Pick<Conversation, 'buyerUserId' | 'buyerImUserId' | 'buyerNickname'>;

export function participants(c: Conversation & ConversationBuyer, shopName: string) {
  const list: Record<string, unknown>[] = [
    { role: 'BUYER', user_id: c.buyerUserId, im_user_id: c.buyerImUserId, nickname: c.buyerNickname, avatar: '' },
    { role: 'SHOP', user_id: c.shopImUserId, im_user_id: c.shopImUserId, nickname: shopName, avatar: '' },
  ];
  if (c.agentJoined) list.push({ role: 'CUSTOMER_SERVICE', user_id: `${c.shopImUserId}-cs`, im_user_id: `${c.shopImUserId}-cs`, nickname: 'Customer service', avatar: '' });
  return list;
}

export function messageItem(m: ChatMessage, needData: boolean) {
  return {
    id: m.externalId,
    index: String(m.index),
    type: m.type,
    content: m.content,
    create_time: secs(m.createdAt),
    is_visible: m.isVisible,
    sender: { role: m.senderRole, im_user_id: m.senderImUserId, nickname: m.senderNickname, avatar: '' },
    // `data` (cards) is only filled for card types, which the simulator does not create
    ...(needData ? { data: '' } : {}),
  };
}

export function conversationItem(c: Conversation, shopName: string, latest: ChatMessage | null, unread: number) {
  return {
    id: c.externalId,
    create_time: secs(c.createdAt),
    can_send_message: c.canSendMessage,
    participant_count: c.agentJoined ? 3 : 2,
    participants: participants(c, shopName),
    unread_count: unread,
    ...(latest ? { latest_message: messageItem(latest, false) } : {}),
  };
}
