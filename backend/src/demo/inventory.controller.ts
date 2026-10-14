import { Controller, ForbiddenException, Get, Inject, Param, Query, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DemoRequest, DemoSessionGuard } from './demo-session.guard';

/** Seller view of the stock history: every change with before/after and the API calls (including the ones that never got an answer). */
@Controller()
export class InventoryDemoController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('shops/:shopId/inventory/history')
  @UseGuards(DemoSessionGuard)
  async history(@Req() req: DemoRequest, @Param('shopId') shopId: string, @Query('limit') limit?: string) {
    const p = req.demo!;
    if (p.shopId !== shopId) throw new ForbiddenException('This session cannot access another shop');
    if (p.role !== 'SELLER') throw new ForbiddenException('Only a seller session can read the inventory history');
    return historyOf(this.prisma, shopId, limit);
  }
}

export async function historyOf(prisma: PrismaService, shopId: string, limit?: string) {
  const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const [changes, attempts] = await Promise.all([
    prisma.inventoryChange.findMany({ where: { shopId }, orderBy: { seq: 'desc' }, take, include: { sku: { select: { externalId: true, sellerSku: true } }, warehouse: { select: { externalId: true, name: true } } } }),
    prisma.inventoryUpdateAttempt.findMany({ where: { shopId }, orderBy: { seq: 'desc' }, take }),
  ]);
  return {
    changes: changes.map((c) => ({ seq: c.seq, sku: c.sku.externalId, sellerSku: c.sku.sellerSku, warehouse: c.warehouse.externalId, warehouseName: c.warehouse.name, before: c.before, after: c.after, source: c.source, noop: c.noop, requestId: c.requestId, note: c.note, at: c.createdAt.toISOString() })),
    attempts: attempts.map((a) => ({ seq: a.seq, product: a.productId, outcome: a.outcome, itemsTotal: a.itemsTotal, itemsApplied: a.itemsApplied, itemsFailed: a.itemsFailed, requestId: a.requestId, at: a.createdAt.toISOString() })),
  };
}
