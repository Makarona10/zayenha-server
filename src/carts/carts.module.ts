import { Module } from '@nestjs/common';
import { CartsService } from './carts.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/common/services/redis.service';
import { CartsController } from './carts.controller';

@Module({
  controllers: [CartsController],
  providers: [CartsService, PrismaService, RedisService],
  exports: [CartsService],
})
export class CartsModule {}
