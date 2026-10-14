import { BadRequestException, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import { TiktokFault } from '../common/tiktok-fault';
import { DOC_TYPES, DocType, FulfillmentService } from '../fulfillment/fulfillment.service';
import { OrderRuleError } from '../orders/orders.service';
import { SCOPE_FULFILLMENT_READ, SCOPE_FULFILLMENT_WRITE } from '../oauth/scopes';
import { PrismaService } from '../prisma/prisma.service';
import { parseRawQuery } from './signature';
import { RequireScope, TiktokApiGuard, TiktokRequest } from './tiktok-api.guard';
import { TiktokFaultFilter } from './tiktok-fault.filter';

const SHIP_BODY_FIELDS = new Set(['handover_method', 'pickup_slot', 'self_shipment']);
const HANDOVER = new Set(['PICKUP', 'DROP_OFF']);
const sec = (d: Date): number => Math.floor(d.getTime() / 1000);

/**
 * Fulfillment reads and the ship-package write (official OAS shapes: schemas/ops/fulfillment.*).
 * Every lookup is scoped to the shop of the token; an order/package of another shop is exactly as unknown as a nonexistent one.
 * The document URL points at a /demo/files route (not part of this router) so it is downloadable from the host and from Docker.
 * Unverified: error codes, the 24 h document validity (not enforced), and the package status before shipment is arranged.
 */
@Controller()
@UseFilters(TiktokFaultFilter)
export class FulfillmentController {
  constructor(
    @Inject(FulfillmentService) private readonly fulfillment: FulfillmentService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get('fulfillment/202309/orders/:orderId/tracking')
  @UseGuards(TiktokApiGuard)
  @RequireScope(SCOPE_FULFILLMENT_READ)
  async tracking(@Req() req: TiktokRequest, @Param('orderId') orderId: string) {
    const shop = req.tiktok!.shop;
    const events = await this.guarded(() => this.fulfillment.trackingOf(shop.id, orderId), 'order_not_found', 'order does not exist in this shop');
    return this.envelope(req, { tracking: events.map((e) => ({ description: e.description, update_time_millis: e.at.getTime() })) });
  }

  @Get('fulfillment/202309/packages/:packageId/shipping_documents')
  @UseGuards(TiktokApiGuard)
  @RequireScope(SCOPE_FULFILLMENT_READ)
  async documents(@Req() req: TiktokRequest, @Param('packageId') packageId: string) {
    const shop = req.tiktok!.shop;
    const q = parseRawQuery(req.originalUrl)!.query;
    if (!q.document_type) throw new TiktokFault(400, 'invalid_input', 'document_type is required');
    if (!(DOC_TYPES as readonly string[]).includes(q.document_type)) {
      throw new TiktokFault(400, 'invalid_input', `document_type ${q.document_type} is not supported by the simulator (supported: ${DOC_TYPES.join(', ')})`);
    }
    if (q.document_format && q.document_format !== 'PDF') throw new TiktokFault(400, 'invalid_input', 'only document_format PDF is supported');
    if (q.document_size && !['A6', 'A5'].includes(q.document_size)) throw new TiktokFault(400, 'invalid_input', 'document_size must be A6 or A5 (the simulator always renders its own size)');
    await this.guarded(() => this.fulfillment.packageOf(shop.id, packageId), 'package_not_found', 'package does not exist in this shop');
    try {
      const doc = await this.fulfillment.documentFor(shop.id, packageId, q.document_type as DocType);
      return this.envelope(req, { doc_url: this.fulfillment.documentUrl(doc.token), tracking_number: doc.trackingNumber });
    } catch (e) {
      if (e instanceof OrderRuleError && e.code === 'package_not_arranged') throw new TiktokFault(400, 'package_not_arranged', e.message);
      throw e;
    }
  }

  @Get('fulfillment/202309/packages/:packageId')
  @UseGuards(TiktokApiGuard)
  @RequireScope(SCOPE_FULFILLMENT_READ)
  async detail(@Req() req: TiktokRequest, @Param('packageId') packageId: string) {
    const shop = req.tiktok!.shop;
    const pkg = await this.guarded(() => this.fulfillment.packageOf(shop.id, packageId), 'package_not_found', 'package does not exist in this shop');
    const o = pkg.order;
    const warehouse = o.warehouseId ? await this.prisma.warehouse.findUnique({ where: { id: o.warehouseId } }) : null;
    const lines = await this.prisma.packageLine.findMany({ where: { packageId: pkg.id }, select: { orderLineId: true } });
    const lineIds = new Map(o.lines.map((l) => [l.id, l.externalId]));
    return this.envelope(req, {
      package_id: pkg.externalId,
      package_status: pkg.status,
      create_time: sec(pkg.createdAt),
      update_time: sec(pkg.updatedAt),
      tracking_number: pkg.trackingNumber ?? undefined,
      shipping_provider_id: pkg.shippingProviderId,
      shipping_provider_name: pkg.shippingProviderName,
      shipping_type: 'TIKTOK',
      handover_method: pkg.handoverMethod ?? undefined,
      has_multi_skus: new Set(o.lines.map((l) => l.skuExternalId)).size > 1,
      split_and_combine_tag: 'DEFAULT',
      note_tag: o.buyerMessage ? 'BUYER_NOTED' : 'BUYER_UNNOTED',
      order_line_item_ids: lines.map((l) => lineIds.get(l.orderLineId)).filter((id): id is string => !!id),
      orders: [{ id: o.externalId }],
      recipient_address: {
        name: o.recipientName,
        phone_number: o.recipientPhone,
        address_detail: o.addressLine,
        address_line1: o.addressLine,
        full_address: `${o.addressLine}, ${o.district}, ${o.city}`,
        postal_code: o.postalCode,
        region_code: 'VN',
      },
      sender_address: warehouse ? { name: warehouse.name, full_address: `${warehouse.name}, ${warehouse.city}`, address_detail: warehouse.city, region_code: 'VN' } : undefined,
    });
  }

  /** Ship package. Only an arranged-able package of an order in AWAITING_SHIPMENT; a repeat on an already arranged package succeeds without a second package. */
  @Post('fulfillment/202309/packages/:packageId/ship')
  @HttpCode(200)
  @UseGuards(TiktokApiGuard)
  @RequireScope(SCOPE_FULFILLMENT_WRITE)
  async ship(@Req() req: TiktokRequest, @Param('packageId') packageId: string) {
    const shop = req.tiktok!.shop;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body !== 'object' || Array.isArray(body)) throw new TiktokFault(400, 'invalid_input', 'request body must be a JSON object');
    for (const k of Object.keys(body)) if (!SHIP_BODY_FIELDS.has(k)) throw new TiktokFault(400, 'invalid_input', `unknown body field "${k}"`);
    if (body.handover_method !== undefined && (typeof body.handover_method !== 'string' || !HANDOVER.has(body.handover_method))) throw new TiktokFault(400, 'invalid_input', 'handover_method must be PICKUP or DROP_OFF');
    if (body.self_shipment !== undefined) throw new TiktokFault(400, 'invalid_input', 'self_shipment is not supported: the simulator only models platform (TIKTOK) shipping');
    const pkg = await this.guarded(() => this.fulfillment.packageOf(shop.id, packageId), 'package_not_found', 'package does not exist in this shop');
    try {
      await this.fulfillment.arrangeShipment(shop.id, pkg.order.externalId, 'SELLER', req.requestId, body.handover_method as string | undefined);
    } catch (e) {
      if (e instanceof OrderRuleError) throw new TiktokFault(400, 'order_not_shippable', `${e.code}: ${e.message}`);
      throw e;
    }
    return this.envelope(req, {});
  }

  private async guarded<T>(fn: () => Promise<T>, kind: 'order_not_found' | 'package_not_found', message: string): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof NotFoundException) throw new TiktokFault(404, kind, message);
      if (e instanceof BadRequestException) throw e;
      throw e;
    }
  }

  private envelope(req: TiktokRequest, data: unknown) {
    return { code: 0, message: 'Success', request_id: req.requestId ?? 'unknown', data };
  }
}
