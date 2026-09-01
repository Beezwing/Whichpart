import { Module } from '@nestjs/common';
import {
  CustomerOrdersController,
  SupplierOrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [CustomerOrdersController, SupplierOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
