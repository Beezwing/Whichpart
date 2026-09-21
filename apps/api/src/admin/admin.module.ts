import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { AdminSuppliersController } from './admin-suppliers.controller';
import { AdminSuppliersService } from './admin-suppliers.service';
import { AdminSearchTermsController } from './admin-search-terms.controller';
import { AdminSearchTermsService } from './admin-search-terms.service';
import { AdminInvoicesController } from './admin-invoices.controller';
import { AdminInvoicesService } from './admin-invoices.service';
import { AdminPhotoRequestsController } from './admin-photo-requests.controller';

@Module({
  imports: [ProductsModule],
  controllers: [
    AdminSuppliersController,
    AdminSearchTermsController,
    AdminInvoicesController,
    AdminPhotoRequestsController,
  ],
  providers: [
    AdminSuppliersService,
    AdminSearchTermsService,
    AdminInvoicesService,
  ],
})
export class AdminModule {}
