import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AftersaleService } from './aftersale.service';

/** Cancellations and returns/refunds. Shared by the TikTok router (approve/reject are TikTok-defined writes), /demo and the Test Console. */
@Module({ imports: [OrdersModule], providers: [AftersaleService], exports: [AftersaleService] })
export class AftersaleModule {}
