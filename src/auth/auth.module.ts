import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { UsersService } from 'src/users/users.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from 'src/common/services/redis.service';
import { RefreshTokenRateLimitMiddleware } from 'src/common/middlewares/rate-limit.middleware';
import { PassportModule } from '@nestjs/passport';
import { MailerModule } from '@nestjs-modules/mailer';
import { MerchantsService } from 'src/merchants/merchants.service';
import { MerchantIdMiddleware } from './middlewares/merchant-validate.middleware';
import { OptionalJwtStrategy } from './strategies/optional-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    UsersModule,
    PrismaModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('MAIL_HOST'),
          port: +configService.get<number>('MAIL_PORT'),
          secure: false,
          auth: {
            user: configService.get<string>('MAIL_USER'),
            pass: configService.get<string>('MAIL_PASS'),
          },
        },
        defaults: {
          from: `"No Reply" <${configService.get<string>('MAIL_FROM')}>`,
        },
      }),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRATION', '24d'),
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    UsersService,
    MerchantsService,
    LocalStrategy,
    JwtStrategy,
    OptionalJwtStrategy,
    RedisService,
    ConfigService,
  ],
  controllers: [AuthController],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MerchantIdMiddleware).forRoutes('auth/merchant/login');
    consumer.apply(RefreshTokenRateLimitMiddleware).forRoutes('auth/refresh');
  }
}
