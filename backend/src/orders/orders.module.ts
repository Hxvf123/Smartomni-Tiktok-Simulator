import { Module } from '@nestjs/common';
import { WebhookEmitter } from '../webhooks/webhook-emitter.service';
import { OrdersService } from './orders.service';

/** Write side of orders. Imported by Demo (buyer/seller) and TestAdmin; the TikTok router never imports it. */
@Module({ providers: [WebhookEmitter, OrdersService], exports: [OrdersService, WebhookEmitter] })
export class OrdersModule {}
