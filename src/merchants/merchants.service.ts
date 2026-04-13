import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MerchantRegister } from './types';

@Injectable()
export class MerchantsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createMerchant(data: {
    name: string;
    email: string;
    password: string;
    address: string;
    phoneNumber: string;
  }) {
    return this.prismaService.merchant.create({
      data,
    });
  }

  async createMerchantAccount(user: MerchantRegister, hash: string) {
    try {
      const created = await this.createMerchant({
        ...user,
        password: hash,
      });
      return created;
    } catch (error: any) {
      if (error?.code === 'P2002' && error?.meta?.target?.includes('email')) {
        throw new BadRequestException('Email already exists');
      }
      throw new InternalServerErrorException(
        error?.message || 'Failed to create merchant account',
      );
    }
  }

  async findMerchant(email: string) {
    const merchant = await this.prismaService.merchant.findUnique({
      where: { email },
    });
    return merchant;
  }

  async isMerchantActive(id: number) {
    const merchant = await this.prismaService.merchant.findUnique({
      where: { id },
    });
    return merchant.status === 'approved' ? true : false;
  }
}
