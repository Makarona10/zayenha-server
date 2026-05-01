import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersService } from './users/users.service';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { MerchantsController } from './merchants/merchants.controller';
import { MerchantsService } from './merchants/merchants.service';
import { MerchantsModule } from './merchants/merchants.module';
import { OrdersService } from './orders/orders.service';
import { OrdersModule } from './orders/orders.module';
import { CartsController } from './carts/carts.controller';
import { CartsModule } from './carts/carts.module';
import { TransactionsService } from './transactions/transactions.service';
import { TransactionsModule } from './transactions/transactions.module';
import { MeterialsModule } from './meterials/meterials.module';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { CategoriesModule } from './categories/categories.module';
import { WishlistsController } from './wishlists/wishlists.controller';
import { WishlistsModule } from './wishlists/wishlists.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersController } from './users/users.controller';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AddressesService } from './addresses/addresses.service';
import { AddressesModule } from './addresses/addresses.module';
import { BullModule } from '@nestjs/bull';

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
          limit: 3,
        },
      ],
    }),
    AddressesModule,
  ],
  controllers: [
    AppController,
    UsersController,
    MerchantsController,
    CartsController,
    CategoriesController,
    WishlistsController,
    UsersController,
  ],
  providers: [
    AppService,
    UsersService,
    MerchantsService,
    OrdersService,
    TransactionsService,
    CategoriesService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AddressesService,
  ],
})
export class AppModule {}
