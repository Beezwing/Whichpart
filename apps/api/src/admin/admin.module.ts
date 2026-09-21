import { Module } from '@nestjs/common';
import { AdminSuppliersController } from './admin-suppliers.controller';
import { AdminSuppliersService } from './admin-suppliers.service';
import { AdminSearchTermsController } from './admin-search-terms.controller';
import { AdminSearchTermsService } from './admin-search-terms.service';
import { AdminInvoicesController } from './admin-invoices.controller';
import { AdminInvoicesService } from './admin-invoices.service';

@Module({
  controllers: [
    AdminSuppliersController,
    AdminSearchTermsController,
    AdminInvoicesController,
  ],
  providers: [
    AdminSuppliersService,
    AdminSearchTermsService,
    AdminInvoicesService,
  ],
})
export class AdminModule {}
