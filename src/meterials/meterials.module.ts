import { Module } from '@nestjs/common';
import { MeterialsService } from './meterials.service';
import { MeterialsController } from './meterials.controller';

@Module({
  providers: [MeterialsService],
  controllers: [MeterialsController]
})
export class MeterialsModule {}
