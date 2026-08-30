import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  UserRole,
  adminUpdatePlanSchema,
  type AdminUpdatePlanInput,
} from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscription-plans')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  /** Public — pricing must be visible before anyone commits to a plan. */
  @Get()
  list() {
    return this.subscriptions.listActivePlans();
  }
}

@Controller('admin/subscription-plans')
@Auth(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list() {
    return this.subscriptions.listAllPlans();
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminUpdatePlanSchema))
    body: AdminUpdatePlanInput,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.subscriptions.updatePlan(id, admin.id, body);
  }
}
