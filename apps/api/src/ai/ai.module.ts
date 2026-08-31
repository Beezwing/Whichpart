import { Global, Module } from '@nestjs/common';
import { AiCategorizationService } from './ai-categorization.service';

@Global()
@Module({
  providers: [AiCategorizationService],
  exports: [AiCategorizationService],
})
export class AiModule {}
