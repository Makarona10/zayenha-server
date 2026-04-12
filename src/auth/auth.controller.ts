import {
  Body,
  Controller,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './jwt-local.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request, Response } from 'express';
import { MerchantRegisterDto, RegisterDto } from './dto/register.dto';
import { Payload } from './interfaces/payload.interface';
import { resObj } from 'src/utils';
import { MerchantsService } from 'src/merchants/merchants.service';
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { ttl: 60000, limit: 10 } })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UsersService,
    private readonly merchantService: MerchantsService,
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const { ...user } = body;
    const { hash } = await this.authService.hashPassword(user.password);
    await this.userService.createUser(user, hash);
    return resObj(201, 'User created successfully', []);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
  async login(@Req() req: Request, @Res() res: Response) {
    const response = await this.authService.login(req.user as Payload, res);
    return res.json(resObj(200, 'Login successfully', response));
  }

  @Post('refresh')
  async refreshToken(@Req() req: Request, res: Response) {
    const refresh_token = req?.cookies['refresh_token'];

    const user = await this.authService.decodeToken(refresh_token);
    if (!user) throw new UnauthorizedException('Invalid token');

    const isValid = await this.authService.validateRefreshToken(
      user.id,
      refresh_token,
    );
    if (!isValid) throw new UnauthorizedException('Invalid refresh token');

    await this.authService.revokeToken(user.id);
    return this.authService.login(user, res);
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body('email') email: string) {
    const msg = await this.authService.generateResetCode(email);
    return resObj(200, msg, []);
  }

  @Patch('reset-password')
  async resetPassword(
    @Body('email') email: string,
    @Body('code') code: string,
    @Body('newPassword') newPassword: string,
  ) {
    await this.authService.resetPassword(email, code.toString(), newPassword);
    return resObj(200, 'Password reset successfully', []);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request) {
    await this.authService.logout(req.user as Payload);
    return resObj(200, 'Logout successfully', []);
  }

  @Post('merchant/register')
  async registerMerchant(@Body() body: MerchantRegisterDto) {
    const { ...merchant } = body;
    const { hash } = await this.authService.hashPassword(merchant.password);
    await this.merchantService.createMerchantAccount(merchant, hash);
    return resObj(201, 'Merchant account created successfully', []);
  }

  @Post('merchant/login')
  @HttpCode(200)
  async merchantLogin(
    @Req() req: Request,
    @Body() body: { email?: string; password?: string },
    @Res() res: Response,
  ) {
    const merchant = (req as any).merchant as Payload;
    const vaildatedMerchant = await this.authService.validateMerchant({
      email: merchant.email,
      password: body.password,
    });
    if (!vaildatedMerchant) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const response = await this.authService.merchantLogin(merchant, res);
    return res.json(resObj(200, 'Merchant login successfully', response));
  }
}
