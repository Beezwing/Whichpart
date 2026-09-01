import { Body, Controller, Post } from '@nestjs/common';
import {
  checkoutRequestSchema,
  type CheckoutRequestInput,
} from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CheckoutService } from './checkout.service';

@Controller('checkout')
@Auth()
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(checkoutRequestSchema))
    body: CheckoutRequestInput,
  ) {
    return this.checkout.checkout(user.id, body);
  }
}
