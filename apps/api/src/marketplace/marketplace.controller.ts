import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  availabilityRequestSchema,
  type AvailabilityRequestInput,
} from '@autoparts/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
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

  @Post('suppliers/:id/availability')
  getAvailability(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(availabilityRequestSchema))
    body: AvailabilityRequestInput,
  ) {
    return this.marketplace.getAvailability(id, body);
  }
}
