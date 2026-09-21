import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { AdminInvoicesService } from './admin-invoices.service';

@Controller('admin/invoices')
@Auth(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminInvoicesController {
  constructor(private readonly adminInvoices: AdminInvoicesService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.adminInvoices.list(status);
  }

  @Post('generate')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body('month') month: string,
  ) {
    return this.adminInvoices.generateForMonth(user.id, month);
  }

  @Post(':id/mark-paid')
  markPaid(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.adminInvoices.markPaid(user.id, id);
  }
}
