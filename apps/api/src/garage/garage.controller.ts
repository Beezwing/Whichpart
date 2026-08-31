import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { savedVehicleSchema, type SavedVehicleInput } from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GarageService } from './garage.service';

@Controller('garage')
@Auth()
export class GarageController {
  constructor(private readonly garage: GarageService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.garage.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(savedVehicleSchema)) body: SavedVehicleInput,
  ) {
    return this.garage.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(savedVehicleSchema)) body: SavedVehicleInput,
  ) {
    return this.garage.update(user.id, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.garage.remove(user.id, id);
  }
}
