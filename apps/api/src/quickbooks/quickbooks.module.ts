import { Global, Module } from '@nestjs/common';
import { QuickBooksService } from './quickbooks.service';
import { QuickBooksController } from './quickbooks.controller';

@Global()
@Module({
  controllers: [QuickBooksController],
  providers: [QuickBooksService],
  exports: [QuickBooksService],
})
export class QuickBooksModule {}
