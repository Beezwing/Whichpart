import { Module } from '@nestjs/common';
import { AdminSuppliersController } from './admin-suppliers.controller';
import { AdminSuppliersService } from './admin-suppliers.service';
import { AdminSearchTermsController } from './admin-search-terms.controller';
import { AdminSearchTermsService } from './admin-search-terms.service';

@Module({
  controllers: [AdminSuppliersController, AdminSearchTermsController],
  providers: [AdminSuppliersService, AdminSearchTermsService],
})
export class AdminModule {}
