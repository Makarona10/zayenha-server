import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { WinstonLogger } from 'src/logger/winston.logger';
import { CategoriesService } from 'src/categories/categories.service';

@Module({
  providers: [ProductsService, PrismaService, WinstonLogger, CategoriesService],
  controllers: [ProductsController],
})
export class ProductsModule {}
