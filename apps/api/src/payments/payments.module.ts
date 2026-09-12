import { Global, Module } from '@nestjs/common';
import { DimePayService } from './dimepay.service';
import { DimePayWebhookController } from './dimepay-webhook.controller';

@Global()
@Module({
  controllers: [DimePayWebhookController],
  providers: [DimePayService],
  exports: [DimePayService],
})
export class PaymentsModule {}
