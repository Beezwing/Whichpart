import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@autoparts/shared';
import {
  addInternalNoteSchema,
  rejectSupplierSchema,
  requestInfoSchema,
  suspendSupplierSchema,
  type AddInternalNoteInput,
  type RejectSupplierInput,
  type RequestInfoInput,
  type SuspendSupplierInput,
} from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminSuppliersService } from './admin-suppliers.service';

@Controller('admin/suppliers')
@Auth(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminSuppliersController {
  constructor(private readonly adminSuppliers: AdminSuppliersService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.adminSuppliers.list(
      status,
      Number(page) || 1,
      Number(pageSize) || 20,
    );
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.adminSuppliers.getDetail(id);
  }

  @Post(':id/start-review')
  startReview(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminSuppliers.startReview(id, admin.id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser) {
    return this.adminSuppliers.approve(id, admin.id);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectSupplierSchema))
    body: RejectSupplierInput,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminSuppliers.reject(id, admin.id, body.reason);
  }

  @Post(':id/request-info')
  requestInfo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(requestInfoSchema)) body: RequestInfoInput,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminSuppliers.requestInfo(id, admin.id, body.message);
  }

  @Post(':id/suspend')
  suspend(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(suspendSupplierSchema))
    body: SuspendSupplierInput,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminSuppliers.suspend(id, admin.id, body.reason);
  }

  @Post(':id/reactivate')
  reactivate(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser) {
    return this.adminSuppliers.reactivate(id, admin.id);
  }

  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addInternalNoteSchema))
    body: AddInternalNoteInput,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminSuppliers.addNote(id, admin.id, body.note);
  }
}
