import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CartsService } from './carts.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { resObj } from 'src/utils';

@Controller('carts')
@UseGuards(JwtAuthGuard)
export class CartsController {
  constructor(private cartsService: CartsService) {}

  @Post('add')
  async addToCart(
    @Body() addToCartDto: AddToCartDto,
    @Query('lang') lang: 'ar' | 'en',
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const result = await this.cartsService.addToCart(
      userId,
      addToCartDto,
      lang,
    );
    return resObj(201, 'Product added to cart successfully', result);
  }

  @Get()
  async getCart(@Req() req: any, @Query('language') language: 'en' | 'ar') {
    const userId = req.user.id;
    const cart = await this.cartsService.getCart(+userId, language);

    return resObj(200, 'Cart retrieved successfully', cart);
  }
}
