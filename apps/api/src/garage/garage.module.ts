import { Module } from '@nestjs/common';
import { GarageController } from './garage.controller';
import { GarageService } from './garage.service';

@Module({
  controllers: [GarageController],
  providers: [GarageService],
})
export class GarageModule {}
