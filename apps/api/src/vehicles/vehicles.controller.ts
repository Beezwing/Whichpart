import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  UserRole,
  createEngineSchema,
  createMakeSchema,
  createModelSchema,
  type CreateEngineInput,
  type CreateMakeInput,
  type CreateModelInput,
} from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get('makes')
  listMakes() {
    return this.vehicles.listMakes();
  }

  @Get('models')
  listModels(@Query('makeId') makeId: string) {
    return this.vehicles.listModels(makeId);
  }

  @Get('engines')
  listEngines(@Query('modelId') modelId: string) {
    return this.vehicles.listEngines(modelId);
  }
}

@Controller('admin/vehicles')
@Auth(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminVehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Post('makes')
  createMake(
    @Body(new ZodValidationPipe(createMakeSchema)) body: CreateMakeInput,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.vehicles.createMake(admin.id, body);
  }

  @Delete('makes/:id')
  deleteMake(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser) {
    return this.vehicles.deleteMake(admin.id, id);
  }

  @Post('models')
  createModel(
    @Body(new ZodValidationPipe(createModelSchema)) body: CreateModelInput,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.vehicles.createModel(admin.id, body);
  }

  @Delete('models/:id')
  deleteModel(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.vehicles.deleteModel(admin.id, id);
  }

  @Post('engines')
  createEngine(
    @Body(new ZodValidationPipe(createEngineSchema)) body: CreateEngineInput,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.vehicles.createEngine(admin.id, body);
  }

  @Delete('engines/:id')
  deleteEngine(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.vehicles.deleteEngine(admin.id, id);
  }
}
