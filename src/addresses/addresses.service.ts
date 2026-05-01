import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

interface AddressInterface {
  city: string;
  district: string;
  street: string;
  building?: string;
  details?: string;
}

@Injectable()
export class AddressesService {
  constructor(private readonly prismaService: PrismaService) {}

  async getAddresses(userId: number) {
    return this.prismaService.address.findMany({
      where: { userId },
    });
  }

  async getAdress(userId: number, addressId: number) {
    return this.prismaService.address.findFirst({
      where: { userId, id: addressId },
    });
  }

  async saveAddress(userId: number, address: AddressInterface) {
    return this.prismaService.address.create({
      data: {
        userId,
        ...address,
      },
    });
  }

  stringifyAddress(address: AddressInterface) {
    return `${address.city}, ${address.district}, ${address.street}, ${
      address.building ?? ''
    }, ${address.details ?? ''}`;
  }
}
