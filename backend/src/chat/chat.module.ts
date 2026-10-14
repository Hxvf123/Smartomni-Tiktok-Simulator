import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { ChatService } from './chat.service';

/** Write side of conversations (uses the shared transactional-outbox emitter exported by OrdersModule). Never imported by the TikTok router. */
@Module({ imports: [OrdersModule], providers: [ChatService], exports: [ChatService] })
export class ChatModule {}
