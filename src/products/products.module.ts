import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { WinstonLogger } from 'src/logger/winston.logger';
import { CategoriesService } from 'src/categories/categories.service';
import { MerchantsService } from 'src/merchants/merchants.service';

@Module({
  providers: [
    ProductsService,
    PrismaService,
    WinstonLogger,
    CategoriesService,
    MerchantsService,
  ],
  controllers: [ProductsController],
})
export class ProductsModule {}
