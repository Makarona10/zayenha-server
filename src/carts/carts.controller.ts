import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  Query,
  Patch,
  Param,
  ParseIntPipe,
  Delete,
} from '@nestjs/common';
import { CartsService } from './carts.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { resObj } from 'src/utils';
import { FastifyRequest } from 'fastify';

@Controller('carts')
@UseGuards(JwtAuthGuard)
export class CartsController {
  constructor(private cartsService: CartsService) {}

  @Post('add')
  async addToCart(
    @Body() addToCartDto: AddToCartDto,
    @Query('lang') lang: 'ar' | 'en',
    @Req() req: FastifyRequest,
  ) {
    const userId = req.user.id;
    const result = await this.cartsService.addToCart(
      userId,
      addToCartDto,
      lang,
    );
    return resObj(201, 'Product added to cart successfully', result);
  }

  @Patch('decrease-item')
  @UseGuards(JwtAuthGuard)
  async decreaseItem(
    @Req() req: FastifyRequest,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    const userId = req.user.id;
    const result = await this.cartsService.decreaseItemQuantity(
      userId,
      productId,
    );

    return resObj(200, 'Item quantity decreased', result);
  }

  @Delete('remove-item')
  @UseGuards(JwtAuthGuard)
  async removeItem(
    @Req() req: FastifyRequest,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    const userId = req.user.id;
    const result = await this.cartsService.removeItemFromCart(
      userId,
      productId,
    );
    return resObj(200, 'Item removed from cart', result);
  }

  @Get()
  async getCart(
    @Req() req: FastifyRequest,
    @Query('language') language: 'en' | 'ar',
  ) {
    const userId = req.user.id;
    const cart = await this.cartsService.getCart(+userId, language);

    return resObj(200, 'Cart retrieved successfully', cart);
  }

  @Delete('clear')
  async clearCart(@Req() req: FastifyRequest) {
    const userId = req.user.id;
    const result = await this.cartsService.clearCart(+userId);
    return resObj(200, 'Cart cleared successfully', result);
  }
}
