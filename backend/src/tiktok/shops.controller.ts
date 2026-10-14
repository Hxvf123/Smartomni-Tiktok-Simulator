import { Controller, Get, Req, UseFilters, UseGuards } from '@nestjs/common';
import { SCOPE_AUTHORIZED_SHOPS } from '../oauth/scopes';
import { RequireScope, TiktokApiGuard, TiktokRequest } from './tiktok-api.guard';
import { TiktokFaultFilter } from './tiktok-fault.filter';

/**
 * GET /authorization/202309/shops (official OAS shape: schemas/ops/auth.shops.response.json).
 * Returns ONLY the shop of the presented access token. No tenant id exists in this schema.
 * `region: VN` and `seller_type: LOCAL` for the seeded shops are UNVERIFIED (see manifest).
 */
@Controller()
@UseFilters(TiktokFaultFilter)
export class ShopsController {
  @Get('authorization/202309/shops')
  @UseGuards(TiktokApiGuard)
  @RequireScope(SCOPE_AUTHORIZED_SHOPS)
  shops(@Req() req: TiktokRequest) {
    const shop = req.tiktok!.shop;
    return {
      code: 0,
      message: 'Success',
      request_id: req.requestId ?? 'unknown',
      data: { shops: [{ cipher: shop.shopCipher, code: shop.code, id: shop.tiktokShopId, name: shop.name, region: shop.region, seller_type: shop.sellerType }] },
    };
  }
}
