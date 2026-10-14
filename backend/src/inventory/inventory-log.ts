import { Prisma } from '@prisma/client';

export interface InventoryLogRow {
  shopId: string;
  skuId: string;
  warehouseId: string;
  before: number;
  after: number;
  source: 'API' | 'SELLER' | 'ORDER' | 'ADMIN';
  noop?: boolean;
  requestId?: string | null;
  note?: string;
}

/** Append before/after rows inside the caller's transaction, so the log and the stock change commit (or roll back) together. */
export async function logInventory(tx: Prisma.TransactionClient, rows: InventoryLogRow[]): Promise<void> {
  if (rows.length === 0) return;
  await tx.inventoryChange.createMany({
    data: rows.map((r) => ({
      shopId: r.shopId,
      skuId: r.skuId,
      warehouseId: r.warehouseId,
      before: r.before,
      after: r.after,
      source: r.source,
      noop: r.noop ?? false,
      requestId: r.requestId ?? null,
      note: r.note ?? '',
    })),
  });
}
