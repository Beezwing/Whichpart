import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
@Auth()
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.wishlist.list(user.id);
  }

  @Post('products/:id')
  addProduct(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wishlist.addProduct(user.id, id);
  }

  @Delete('products/:id')
  removeProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.wishlist.removeProduct(user.id, id);
  }

  @Post('suppliers/:id')
  addSupplier(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wishlist.addSupplier(user.id, id);
  }

  @Delete('suppliers/:id')
  removeSupplier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.wishlist.removeSupplier(user.id, id);
  }
}
