import { Module } from '@nestjs/common';
import { AdminSuppliersController } from './admin-suppliers.controller';
import { AdminSuppliersService } from './admin-suppliers.service';

@Module({
  controllers: [AdminSuppliersController],
  providers: [AdminSuppliersService],
})
export class AdminModule {}
