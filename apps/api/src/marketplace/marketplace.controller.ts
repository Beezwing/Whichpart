import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  availabilityRequestSchema,
  type AvailabilityRequestInput,
} from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProductsService } from '../products/products.service';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly products: ProductsService,
  ) {}

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

  @Post('products/:id/photo-requests')
  @Auth()
  requestPhotos(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.requestPhotos(user.id, id);
  }

  @Get('products/:id/photo-requests/me')
  @Auth()
  myPhotoRequestStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.getMyPhotoRequestStatus(user.id, id);
  }
}
