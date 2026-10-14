import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { OrderRow, OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { DemoPrincipal, DemoRequest, DemoSessionGuard } from './demo-session.guard';

const CartItemBody = z.object({ skuId: z.string().min(1).max(100), quantity: z.number().int().min(0).max(20) });
const Recipient = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(5).max(30),
  addressLine: z.string().trim().min(1).max(300),
  district: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  postalCode: z.string().max(20).optional(),
});
const CheckoutBody = z.object({
  /** Client-generated idempotency key: submitting the same key twice returns the same order. */
  checkoutKey: z.string().trim().min(8).max(100),
  items: z.array(z.object({ skuId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(20) })).max(50).optional(),
  recipient: Recipient.optional(),
  buyerMessage: z.string().max(500).optional(),
});
const ReasonBody = z.object({ reason: z.string().trim().min(1).max(300).default('no reason given') });

function principal(req: DemoRequest): DemoPrincipal {
  return req.demo!;
}
function assertOwnShop(p: DemoPrincipal, shopId: string): void {
  if (p.shopId !== shopId) throw new ForbiddenException('This session cannot access another shop');
}
function buyerOf(p: DemoPrincipal): { id: string; shopId: string } {
  if (p.role !== 'BUYER' || !p.buyerId) throw new ForbiddenException('Only a buyer session can do this');
  return { id: p.buyerId, shopId: p.shopId };
}

/** What the demo UIs see: integer VND components, lines grouped per SKU with a quantity. */
export function orderView(o: OrderRow) {
  const bySku = new Map<string, { skuId: string; productId: string; productName: string; skuName: string; sellerSku: string; unitPriceVnd: number; quantity: number }>();
  for (const l of o.lines) {
    const row = bySku.get(l.skuExternalId) ?? { skuId: l.skuExternalId, productId: l.productExternalId, productName: l.productName, skuName: l.skuName, sellerSku: l.sellerSku, unitPriceVnd: l.salePrice, quantity: 0 };
    row.quantity += 1;
    bySku.set(l.skuExternalId, row);
  }
  const subTotal = o.originalProductPrice - o.sellerDiscount - o.platformDiscount;
  const shippingFee = o.originalShippingFee - o.shippingFeeDiscount;
  return {
    id: o.externalId,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    releaseAt: o.releaseAt?.toISOString() ?? null,
    cancelReason: o.cancelReason,
    buyerRequestedCancel: o.buyerRequestedCancel,
    recipient: { name: o.recipientName, phone: o.recipientPhone, addressLine: o.addressLine, district: o.district, city: o.city },
    buyer: { id: o.buyer.externalId, name: o.buyer.name },
    amounts: {
      currency: o.currency,
      productTotalVnd: o.originalProductPrice,
      sellerDiscountVnd: o.sellerDiscount,
      platformDiscountVnd: o.platformDiscount,
      subTotalVnd: subTotal,
      shippingFeeVnd: shippingFee,
      taxVnd: o.tax,
      totalVnd: subTotal + shippingFee + o.tax,
    },
    items: [...bySku.values()],
  };
}

/** Buyer cart / checkout / fake payment / order history and the Seller order list. /demo only: none of this is TikTok OpenAPI. */
@Controller()
export class OrdersDemoController {
  constructor(
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get('shops/:shopId/cart')
  @UseGuards(DemoSessionGuard)
  async cart(@Req() req: DemoRequest, @Param('shopId') shopId: string) {
    const p = principal(req);
    assertOwnShop(p, shopId);
    const items = await this.orders.cart(buyerOf(p).id);
    return { currency: 'VND', items, totalVnd: items.reduce((n, i) => n + i.lineTotalVnd, 0) };
  }

  @Put('shops/:shopId/cart/items')
  @UseGuards(DemoSessionGuard)
  async setCartItem(@Req() req: DemoRequest, @Param('shopId') shopId: string, @Body(new ZodPipe(CartItemBody)) body: z.infer<typeof CartItemBody>) {
    const p = principal(req);
    assertOwnShop(p, shopId);
    await this.orders.setCartItem(buyerOf(p), body.skuId, body.quantity);
    return this.cart(req, shopId);
  }

  @Post('shops/:shopId/checkout')
  @UseGuards(DemoSessionGuard)
  async checkout(@Req() req: DemoRequest, @Param('shopId') shopId: string, @Body(new ZodPipe(CheckoutBody)) body: z.infer<typeof CheckoutBody>) {
    const p = principal(req);
    assertOwnShop(p, shopId);
    const buyer = buyerOf(p);
    const fromCart = !body.items;
    const items = body.items ? body.items.map((i) => ({ skuExternalId: i.skuId, quantity: i.quantity })) : (await this.orders.cart(buyer.id)).map((i) => ({ skuExternalId: i.skuId, quantity: i.quantity }));
    const row = await this.prisma.buyer.findUniqueOrThrow({ where: { id: buyer.id } });
    const recipient = body.recipient ?? { name: row.name, phone: row.phone, addressLine: row.addressLine, district: row.district, city: row.city };
    const { order, replayed } = await this.orders.checkout(buyer, { checkoutKey: body.checkoutKey, items, recipient, buyerMessage: body.buyerMessage }, (req as { requestId?: string }).requestId);
    if (fromCart && !replayed) await this.prisma.cartItem.deleteMany({ where: { buyerId: buyer.id } });
    return { replayed, order: orderView(order) };
  }

  @Post('shops/:shopId/orders/:orderId/pay')
  @UseGuards(DemoSessionGuard)
  async pay(@Req() req: DemoRequest, @Param('shopId') shopId: string, @Param('orderId') orderId: string) {
    const p = principal(req);
    assertOwnShop(p, shopId);
    const { order, replayed } = await this.orders.pay(buyerOf(p), orderId, (req as { requestId?: string }).requestId);
    return { replayed, order: orderView(order) };
  }

  @Post('shops/:shopId/orders/:orderId/cancel')
  @UseGuards(DemoSessionGuard)
  async cancel(@Req() req: DemoRequest, @Param('shopId') shopId: string, @Param('orderId') orderId: string, @Body(new ZodPipe(ReasonBody)) body: z.infer<typeof ReasonBody>) {
    const p = principal(req);
    assertOwnShop(p, shopId);
    if (p.role === 'BUYER') return { order: orderView(await this.orders.buyerCancel(buyerOf(p), orderId, body.reason, (req as { requestId?: string }).requestId)) };
    const order = await this.prisma.order.findFirst({ where: { shopId, externalId: orderId }, select: { id: true } });
    if (!order) throw new NotFoundException('Unknown order');
    const updated = await this.orders.transition(order.id, 'CANCELLED', 'SELLER', { note: body.reason, cancelReason: body.reason, initiator: 'SELLER', requestId: (req as { requestId?: string }).requestId });
    return { order: orderView(updated) };
  }

  /** Buyer: own orders. Seller: every order of the shop. */
  @Get('shops/:shopId/orders')
  @UseGuards(DemoSessionGuard)
  async list(@Req() req: DemoRequest, @Param('shopId') shopId: string) {
    const p = principal(req);
    assertOwnShop(p, shopId);
    const rows = p.role === 'BUYER' ? await this.orders.listForBuyer(buyerOf(p).id) : await this.orders.listForShop(shopId);
    return { items: rows.map(orderView) };
  }

  @Get('shops/:shopId/orders/:orderId')
  @UseGuards(DemoSessionGuard)
  async detail(@Req() req: DemoRequest, @Param('shopId') shopId: string, @Param('orderId') orderId: string) {
    const p = principal(req);
    assertOwnShop(p, shopId);
    const order = await this.prisma.order.findFirst({
      where: { shopId, externalId: orderId, ...(p.role === 'BUYER' ? { buyerId: buyerOf(p).id } : {}) },
      include: { lines: { orderBy: [{ externalId: 'asc' }] }, buyer: { select: { externalId: true, name: true } } },
    });
    if (!order) throw new NotFoundException('Unknown order');
    return { order: orderView(order), history: (await this.orders.audits(order.id)).map((a) => ({ from: a.fromStatus, to: a.toStatus, actor: a.actor, note: a.note, at: a.at.toISOString() })) };
  }
}
