import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { MerchantsModule } from './merchants/merchants.module';
import { OrdersModule } from './orders/orders.module';
import { CartsModule } from './carts/carts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { MeterialsModule } from './meterials/meterials.module';
import { CategoriesModule } from './categories/categories.module';
import { WishlistsModule } from './wishlists/wishlists.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AddressesModule } from './addresses/addresses.module';
import { BullModule } from '@nestjs/bull';
import { RedisService } from './common/services/redis.service';
import { WinstonLogger } from './logger/winston.logger';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    ProductsModule,
    MerchantsModule,
    OrdersModule,
    CartsModule,
    TransactionsModule,
    MeterialsModule,
    CategoriesModule,
    WishlistsModule,
    PrismaModule,
    UsersModule,
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'payment-expiry',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.development'],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 30,
        },
      ],
    }),
    AddressesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    RedisService,
    WinstonLogger,
  ],
})
export class AppModule {}
