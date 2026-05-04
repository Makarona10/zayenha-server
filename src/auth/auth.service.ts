import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from 'src/common/services/redis.service';
import { argon2id, hash, verify } from 'argon2';
import { randomBytes, randomInt } from 'node:crypto';
import { promisify } from 'node:util';
import { UsersService } from 'src/users/users.service';
import * as argon from 'argon2';
import { Payload } from './interfaces/payload.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';
import { MerchantsService } from 'src/merchants/merchants.service';
import { Admin } from '@prisma/client';
import { FastifyReply } from 'fastify';

const randomBytesAsync = promisify(randomBytes);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly merchantService: MerchantsService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly mailerService: MailerService,
  ) {}
  private readonly saltLength = 13;

  async generateTokens(payload: Payload) {
    return {
      access_token: await this.jwtService.signAsync(payload),
      refresh_token: await this.jwtService.signAsync(payload, {
        expiresIn: process.env.JWT_REFRESH_EXPIRATION,
        secret: process.env.JWT_REFRESH_SECRET,
      }),
    };
  }

  async decodeToken(token: string): Promise<any> {
    return this.jwtService.verifyAsync(token);
  }

  async validateRefreshToken(userId: number, refreshToken: string) {
    const storedToken = await this.redisService.getValue(
      `refresh_token:${userId}`,
    );
    if (!storedToken) return false;

    return argon.verify(storedToken, refreshToken, {
      secret: Buffer.from(process.env.JWT_REFRESH_HASH_SECRET, 'base64'),
    });
  }

  async revokeToken(userId: number) {
    await this.redisService.deleteKey(`refresh_token:${userId}`);
  }

  async validateUser(credential: { email: string; password: string }) {
    const user = await this.usersService.findUser(credential.email);
    if (!user) return null;

    const hashedPassword = user.password;

    const result = await this.verifyPassword(
      hashedPassword,
      credential.password,
    );
    if (!result) return null;

    return user;
  }

  async registerAdmin(data: any) {
    const { email, password, firstName, lastName } = data;

    const existingAdmin = await this.prismaService.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      throw new BadRequestException('Admin email already registered');
    }

    const { hash } = await this.hashPassword(password);

    return this.prismaService.admin.create({
      data: {
        email,
        password: hash,
        firstName,
        lastName,
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  }

  async validateAdmin(credential: { email: string; password: string }) {
    const admin = await this.prismaService.admin.findUnique({
      where: { email: credential.email },
    });

    if (!admin) return null;

    const isMatch = await this.verifyPassword(
      admin.password,
      credential.password,
    );
    if (!isMatch) return null;

    return admin;
  }

  async adminLogin(admin: Admin, res: FastifyReply) {
    const payload: Payload = {
      id: admin.id,
      email: admin.email,
      role: 'admin',
    };

    const tokens = await this.generateTokens(payload);

    const hashedRefreshToken = await argon.hash(tokens.refresh_token, {
      hashLength: 60,
      type: argon.argon2id,
      secret: Buffer.from(process.env.JWT_REFRESH_HASH_SECRET, 'base64'),
    });

    res.setCookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await this.redisService.setValue(
      `refresh_token:${payload.id}`,
      hashedRefreshToken,
      Number(process.env.JWT_REFRESH_EXPIRATION),
    );

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
  }

  async login(user: Payload, res: FastifyReply) {
    const payload = { id: user.id, email: user.email, role: 'user' };
    const data = await this.generateTokens(payload);

    const hashedRefreshToken = await argon.hash(data.refresh_token, {
      hashLength: 60,
      type: argon.argon2id,
      secret: Buffer.from(process.env.JWT_REFRESH_HASH_SECRET, 'base64'),
    });

    await this.redisService.setValue(
      `refresh_token:${payload.id}`,
      hashedRefreshToken,
      Number(process.env.JWT_REFRESH_EXPIRATION),
    );

    res.setCookie('refresh_token', data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { access_token: data.access_token };
  }

  async logout(user: Payload) {
    await this.revokeToken(user.id);
  }

  async hashPassword(pass: string) {
    const salt = await randomBytesAsync(this.saltLength);

    const hashedPassword = await hash(pass, {
      salt,
      secret: Buffer.from(process.env.PASSWORD_SECRET, 'base64'),
      type: argon2id,
      timeCost: 3,
      parallelism: 1,
      hashLength: 100,
      memoryCost: 10 * 1024,
    });
    return { hash: hashedPassword };
  }

  async verifyPassword(hash: string, password: string) {
    return verify(hash, password, {
      secret: Buffer.from(process.env.PASSWORD_SECRET, 'base64'),
    });
  }

  async generateResetCode(email: string): Promise<string> {
    if (!email) throw new BadRequestException('Email is required');
    const user = await this.usersService.findUser(email);
    if (!user) throw new BadRequestException('User not found');
    const code = randomInt(100000, 999999).toString();

    await this.prismaService.passwordReset.upsert({
      where: { userId: user.id },
      update: { code, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
      create: {
        userId: user.id,
        code,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Password Reset Code',
      html: `
    <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
      <p style="font-size: 16px; margin-bottom: 20px;">
        Your password reset code for your <strong>zayenha</strong> account is
      </p>
      <p style="font-size: 34px; font-weight: bolder; color: #2c3e50;">
        ${code}
      </p>
    </div>
  `,
    });

    return 'Reset code sent to your email';
  }

  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<string> {
    const user = await this.prismaService.user.findUnique({
      where: { email },
    });
    if (!user) throw new BadRequestException('User not found');

    const resetEntry = await this.prismaService.passwordReset.findUnique({
      where: { userId: user.id },
    });

    if (
      !resetEntry ||
      resetEntry.code !== code ||
      resetEntry.expiresAt < new Date()
    ) {
      throw new BadRequestException('Wrong code');
    }

    const { hash } = await this.hashPassword(newPassword);

    await this.prismaService.user.update({
      where: { id: user.id },
      data: { password: hash },
    });

    await this.prismaService.passwordReset.delete({
      where: { userId: user.id },
    });

    return 'Password reset successfully';
  }

  async merchantLogin(merchant: Payload, res: FastifyReply) {
    const payload = {
      id: merchant.id,
      email: merchant.email,
      role: 'merchant',
    };
    const data = await this.generateTokens(payload);

    const hashedRefreshToken = await argon.hash(data.refresh_token, {
      hashLength: 60,
      type: argon.argon2id,
      secret: Buffer.from(process.env.JWT_REFRESH_HASH_SECRET, 'base64'),
    });

    await this.redisService.setValue(
      `refresh_token:${payload.id}`,
      hashedRefreshToken,
      Number(process.env.JWT_REFRESH_EXPIRATION),
    );

    res.setCookie('refresh_token', data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { access_token: data.access_token };
  }

  async validateMerchant(credential: { email: string; password: string }) {
    const merchant = await this.merchantService.findMerchant(credential.email);
    if (!merchant) return null;

    const hashedPassword = merchant.password;

    const result = await this.verifyPassword(
      hashedPassword,
      credential.password,
    );
    if (!result) return null;

    return merchant;
  }
}
