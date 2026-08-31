import { Module } from '@nestjs/common';
import {
  AdminVehiclesController,
  VehiclesController,
} from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  controllers: [VehiclesController, AdminVehiclesController],
  providers: [VehiclesService],
})
export class VehiclesModule {}
