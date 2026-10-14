import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthClock } from '../clock/clock';
import { PrismaService } from '../prisma/prisma.service';

export interface TokenView {
  id: string;
  appKey: string;
  shopId: string;
  tiktokShopId: string;
  shopName: string;
  scopes: string[];
  status: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  accessExpired: boolean;
  refreshExpired: boolean;
  revokedAt: string | null;
  createdAt: string;
}

/**
 * Test Console actions on token state. Used ONLY from /test-admin (provided by TestAdminModule, never by TiktokModule).
 * "Expire" moves the stored expiry into the past so the normal expiry path (not a special status) is what gets exercised.
 * Views never contain token values or hashes.
 */
@Injectable()
export class TokenAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthClock) private readonly clock: AuthClock,
  ) {}

  private async view(id: string): Promise<TokenView> {
    const t = await this.prisma.token.findUnique({ where: { id }, include: { app: true, shop: true } });
    if (!t) throw new NotFoundException('Unknown token record');
    const now = this.clock.now().getTime();
    return {
      id: t.id,
      appKey: t.app.appKey,
      shopId: t.shopId,
      tiktokShopId: t.shop.tiktokShopId,
      shopName: t.shop.name,
      scopes: t.scopes,
      status: t.status,
      accessExpiresAt: t.accessExpiresAt.toISOString(),
      refreshExpiresAt: t.refreshExpiresAt.toISOString(),
      accessExpired: t.accessExpiresAt.getTime() <= now,
      refreshExpired: t.refreshExpiresAt.getTime() <= now,
      revokedAt: t.revokedAt ? t.revokedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
    };
  }

  async list(shopId?: string): Promise<TokenView[]> {
    const rows = await this.prisma.token.findMany({ where: shopId ? { shopId } : {}, orderBy: { createdAt: 'desc' }, select: { id: true } });
    return Promise.all(rows.map((r) => this.view(r.id)));
  }

  private async mustExist(id: string): Promise<void> {
    if (!(await this.prisma.token.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('Unknown token record');
  }

  async expireAccess(id: string): Promise<TokenView> {
    await this.mustExist(id);
    await this.prisma.token.update({ where: { id }, data: { accessExpiresAt: new Date(this.clock.now().getTime() - 1000) } });
    return this.view(id);
  }

  async expireRefresh(id: string): Promise<TokenView> {
    await this.mustExist(id);
    await this.prisma.token.update({ where: { id }, data: { refreshExpiresAt: new Date(this.clock.now().getTime() - 1000) } });
    return this.view(id);
  }

  /** Seller revoked the app: both tokens stop working immediately. (The SELLER_DEAUTHORIZATION webhook belongs to Phase 05.) */
  async revoke(id: string): Promise<TokenView> {
    await this.mustExist(id);
    await this.prisma.token.update({ where: { id }, data: { status: 'REVOKED', revokedAt: this.clock.now() } });
    return this.view(id);
  }

  /** Removes one scope from the token's GRANTED scopes (not the app's, so a seed re-run cannot undo it). */
  async removeScope(id: string, scope: string): Promise<TokenView> {
    const t = await this.prisma.token.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Unknown token record');
    if (!t.scopes.includes(scope)) throw new NotFoundException('The token does not hold that scope');
    await this.prisma.token.update({ where: { id }, data: { scopes: t.scopes.filter((s) => s !== scope) } });
    return this.view(id);
  }

  /** Makes every still-unused authorization code of a shop expired (to test "code expired" end to end). */
  async expireCodes(shopId?: string): Promise<{ expired: number }> {
    const now = this.clock.now();
    const r = await this.prisma.authorizationCode.updateMany({
      where: { consumedAt: null, expiresAt: { gt: now }, ...(shopId ? { shopId } : {}) },
      data: { expiresAt: new Date(now.getTime() - 1000) },
    });
    return { expired: r.count };
  }
}
