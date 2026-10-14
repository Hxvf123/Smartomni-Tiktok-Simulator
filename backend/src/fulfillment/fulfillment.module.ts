import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { FulfillmentService } from './fulfillment.service';

/** Packages / tracking / shipping documents. Exported so the TikTok router (ship package) and /demo share one implementation. */
@Module({ imports: [OrdersModule], providers: [FulfillmentService], exports: [FulfillmentService] })
export class FulfillmentModule {}
