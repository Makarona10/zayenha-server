import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrdersService } from './orders.service';
import { BullModule } from '@nestjs/bull';
import { PaymentExpiryProcessor } from './payment.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'payment-expiry',
    }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService, PaymentExpiryProcessor],
})
export class OrdersModule {}
