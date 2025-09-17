import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MerchantsService } from './merchants.service';

@Module({})
export class MerchantsModule {
  imports: [];
  controllers: [];
  providers: [PrismaService];
  exports: [MerchantsService];
}
