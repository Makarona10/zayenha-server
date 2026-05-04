import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Adjust path as needed
import { resObj } from 'src/utils';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async addAddress(
    @Req() req: any,
    @Body()
    addressData: {
      city: string;
      district: string;
      street: string;
      building?: string;
      details?: string;
    },
  ) {
    const userId = req.user.id;
    const address = await this.addressesService.createUserAddress(
      userId,
      addressData,
    );
    return resObj(201, 'Address added successfully', address);
  }
}
