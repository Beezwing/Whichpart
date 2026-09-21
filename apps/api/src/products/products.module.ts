import { Module } from '@nestjs/common';
import {
  ProductImagesController,
  ProductsController,
} from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController, ProductImagesController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
