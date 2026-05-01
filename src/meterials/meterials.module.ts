import { Module } from '@nestjs/common';
import { MaterialsService } from './meterials.service';
import { MeterialsController } from './meterials.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [MaterialsService, PrismaService],
  controllers: [MeterialsController],
})
export class MeterialsModule {}
