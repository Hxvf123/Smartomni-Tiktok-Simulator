import { Inject, Injectable } from '@nestjs/common';
import { FaultKind, FaultRule, FaultTarget } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Faults that only the inventory update handler consumes; the generic API middleware and the webhook worker must never use them up. */
export const INVENTORY_FAULT_KINDS: FaultKind[] = ['TIMEOUT_BEFORE_WRITE', 'TIMEOUT_AFTER_WRITE', 'APP_ERROR_200'];

export interface CreateFaultInput {
  shopId?: string | null;
  target: FaultTarget;
  kind: FaultKind;
  pathMatch?: string | null;
  params?: Record<string, unknown>;
  remaining?: number | null;
}

/** Fault rules are created only through /test-admin and consumed by the worker / the TikTok router middleware. */
@Injectable()
export class FaultService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(input: CreateFaultInput): Promise<FaultRule> {
    return this.prisma.faultRule.create({
      data: {
        shopId: input.shopId ?? null,
        target: input.target,
        kind: input.kind,
        pathMatch: input.pathMatch ?? null,
        params: (input.params ?? {}) as any,
        remaining: input.remaining ?? null,
      },
    });
  }

  list(shopId?: string): Promise<FaultRule[]> {
    return this.prisma.faultRule.findMany({
      where: shopId ? { OR: [{ shopId }, { shopId: null }] } : {},
      orderBy: { createdAt: 'asc' },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.faultRule.deleteMany({ where: { id } });
  }

  async clear(shopId?: string): Promise<number> {
    const r = await this.prisma.faultRule.deleteMany({ where: shopId ? { shopId } : {} });
    return r.count;
  }

  /** Return the first matching rule and consume one use (atomic for counted rules). */
  async consume(target: FaultTarget, shopId: string | null, key: string, kinds?: FaultKind[]): Promise<FaultRule | null> {
    const rules = await this.prisma.faultRule.findMany({
      where: {
        target,
        // REORDER is applied when the event is enqueued, never at delivery
        kind: kinds ? { in: kinds } : { notIn: ['REORDER', ...INVENTORY_FAULT_KINDS] },
        OR: shopId ? [{ shopId }, { shopId: null }] : [{ shopId: null }],
        AND: [{ OR: [{ remaining: null }, { remaining: { gt: 0 } }] }],
      },
      orderBy: { createdAt: 'asc' },
    });
    for (const rule of rules) {
      const matches = !rule.pathMatch || (target === 'WEBHOOK' ? rule.pathMatch === key : key.startsWith(rule.pathMatch));
      if (!matches) continue;
      if (rule.remaining === null) return rule;
      const r = await this.prisma.faultRule.updateMany({ where: { id: rule.id, remaining: { gt: 0 } }, data: { remaining: { decrement: 1 } } });
      if (r.count === 1) return rule;
    }
    return null;
  }
}
