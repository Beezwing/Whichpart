import { Controller, Get, Param } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.marketplace.getProduct(id);
  }

  @Get('suppliers/:id')
  getSupplier(@Param('id') id: string) {
    return this.marketplace.getSupplier(id);
  }
}
