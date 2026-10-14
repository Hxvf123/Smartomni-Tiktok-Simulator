import { Inject, Injectable, Module, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { FaultService } from '../faults/fault.service';
import { classifyRouter } from '../http-log/request-log.middleware';
import { OAuthModule } from '../oauth/oauth.module';
import { EventsController } from './events.controller';
import { OrdersController } from './orders.controller';
import { ProductsController } from './products.controller';
import { ShopsController } from './shops.controller';
import { TiktokApiGuard } from './tiktok-api.guard';
import { TokenController } from './token.controller';

/**
 * TikTok-shaped public API (adapter). Method/path/header/JSON shapes come from `contracts/` (Phase 01).
 * Endpoints: GET /api/v2/token/get, GET /api/v2/token/refresh (provisional), GET /authorization/202309/shops (Phase 03);
 * POST /product/202502/products/search, GET /product/202309/products/{id}, GET /logistics/202309/warehouses (Phase 04, read-only);
 * POST /order/202309/orders/search, GET /order/202507/orders, GET/PUT/DELETE /event/202309/webhooks (Phase 05).
 * This module may import only OAuthModule (token lifecycle); it must never import Demo/TestAdmin/Seed/Reset providers; seed, reset, clock and fault control
 * live exclusively under /test-admin, and scenario helpers under /demo.
 * Unmatched paths return Nest's plain 404 - the simulator does not pretend unsupported endpoints exist.
 */
@Injectable()
export class TiktokFaultMiddleware implements NestMiddleware {
  constructor(@Inject(FaultService) private readonly faults: FaultService) {}

  /** Applies API-target fault rules (set via /test-admin/faults) to TikTok-router requests only. */
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const path = req.originalUrl.split('?')[0];
    if (classifyRouter(path) !== 'TIKTOK') return next();
    try {
      const rule = await this.faults.consume('API', ((req as any).shopId as string | undefined) ?? null, path);
      if (!rule) return next();
      if (rule.kind === 'DELAY') {
        await new Promise((r) => setTimeout(r, Math.min(Number((rule.params as any)?.delayMs ?? 1000), 30000)));
        return next();
      }
      if (rule.kind === 'HTTP_ERROR') {
        const status = Number((rule.params as any)?.status ?? 500);
        // Body shape is intentionally NOT TikTok's envelope: it is a simulator marker until Phase 01 fixes the contract.
        res.status(status).json({ simulatorFault: true, message: 'Injected by /test-admin/faults', status });
        return;
      }
      return next();
    } catch (e) {
      return next(e);
    }
  }
}

@Module({
  imports: [OAuthModule],
  controllers: [TokenController, ShopsController, ProductsController, OrdersController, EventsController],
  providers: [TiktokFaultMiddleware, TiktokApiGuard],
  exports: [TiktokFaultMiddleware],
})
export class TiktokModule {}
