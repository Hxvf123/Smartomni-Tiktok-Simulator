import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { hashToken } from '../common/hash';
import { PrismaService } from '../prisma/prisma.service';

export interface DemoPrincipal {
  sessionId: string;
  role: 'SELLER' | 'BUYER';
  shopId: string;
  buyerId: string | null;
}
export type DemoRequest = Request & { demo?: DemoPrincipal; shopId?: string };


/** Session isolation for the Seller/Buyer UIs. This is NOT TikTok auth and is unrelated to SmartOmni login. */
@Injectable()
export class DemoSessionGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<DemoRequest>();
    const raw = req.header('x-demo-session');
    if (!raw) throw new UnauthorizedException('Missing x-demo-session header');
    const session = await this.prisma.demoSession.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (!session || session.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Invalid or expired demo session');
    req.demo = { sessionId: session.id, role: session.role, shopId: session.shopId, buyerId: session.buyerId };
    req.shopId = session.shopId;
    return true;
  }
}

