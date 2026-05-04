import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private prismaService: PrismaService) {}

  async createUserAddress(
    userId: number,
    data: {
      city: string;
      district: string;
      street: string;
      building?: string;
      details?: string;
    },
  ) {
    return await this.prismaService.address.create({
      data: {
        ...data,
        userId: userId,
      },
    });
  }
}
