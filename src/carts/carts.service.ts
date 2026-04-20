import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from 'src/common/services/redis.service';

type FormattedCart = {
  id: number;
  items: {
    productId: number;
    name: string;
    price: number;
    quantity: number;
    image: string;
  }[];
};

@Injectable()
export class CartsService {
  constructor(
    private prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private getCartKey(userId: number, languageCode: 'en' | 'ar'): string {
    return `cart:${userId}:${languageCode}`;
  }

  async cleanupExpiredCarts(): Promise<void> {
    await this.prismaService.cart.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    await this.prismaService.cartItem.deleteMany({
      where: {
        product: {
          stockQuantity: 0,
        },
      },
    });

    return Promise.resolve();
  }

  private async renewCartExpiration(userId: number): Promise<void> {
    await this.prismaService.cart.update({
      where: { userId },
      data: { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
  }

  private async cacheCart(
    userId: number,
    cart: FormattedCart,
    lang: 'en' | 'ar',
  ): Promise<void> {
    await this.redisService.setValue(
      this.getCartKey(userId, lang),
      JSON.stringify(cart),
      60 * 60,
    );
  }

  private formatCart(cart: any): FormattedCart {
    return {
      id: cart.id,
      items: cart.items.map((item) => ({
        productId: item.product.id,
        name: item.product.translations[0]?.name || 'N/A',
        price: item.product.offerPrice ?? item.product.price,
        quantity: item.quantity,
        image: item.product.mainImage,
      })),
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async handleExpiredCarts() {
    await this.cleanupExpiredCarts();
  }

  async addToCart(
    userId: number,
    addToCartDto: AddToCartDto,
    lang: 'ar' | 'en' = 'en',
  ): Promise<void> {
    const { productId, quantity } = addToCartDto;

    const product = await this.prismaService.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        stockQuantity: true,
        status: true,
        price: true,
        offerPrice: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (product.status !== 'approved') {
      throw new BadRequestException(
        'This product is not available for purchase',
      );
    }

    if (product.stockQuantity < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${product.stockQuantity}, Requested: ${quantity}`,
      );
    }

    if (product.stockQuantity === 0) {
      throw new BadRequestException('Product is out of stock');
    }

    const MAX_QUANTITY_PER_ITEM = 99;
    if (quantity > MAX_QUANTITY_PER_ITEM) {
      throw new BadRequestException(
        `Maximum quantity per item is ${MAX_QUANTITY_PER_ITEM}`,
      );
    }

    let cart = await this.prismaService.cart.findUnique({
      where: { userId },
      select: {
        id: true,
        items: {
          where: { productId },
        },
      },
    });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (!cart) {
      cart = await this.prismaService.cart.create({
        data: {
          userId,
          expiresAt,
        },
        select: {
          id: true,
          items: true,
        },
      });
    }

    const existingCartItem = cart.items.find(
      (item) => item.productId === productId,
    );

    if (existingCartItem) {
      const newQuantity = existingCartItem.quantity + quantity;

      if (newQuantity > product.stockQuantity) {
        throw new BadRequestException(
          `Cannot add ${quantity} more. You already have ${existingCartItem.quantity} in cart. Available stock: ${product.stockQuantity}`,
        );
      }

      if (newQuantity > MAX_QUANTITY_PER_ITEM) {
        throw new BadRequestException(
          `Cannot add more. Maximum ${MAX_QUANTITY_PER_ITEM} items per product`,
        );
      }

      await this.prismaService.cartItem.update({
        where: { id: existingCartItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await this.prismaService.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
        },
      });
    }

    await this.renewCartExpiration(userId);

    const newCart = await this.prismaService.cart.findUnique({
      where: { id: cart.id },
      select: {
        id: true,
        userId: true,
        items: {
          select: {
            product: {
              select: {
                id: true,
                translations: {
                  where: { languageCode: lang },
                  select: {
                    name: true,
                  },
                },
                price: true,
                offerPrice: true,
                mainImage: true,
              },
            },
            quantity: true,
          },
        },
      },
    });

    const formattedCart = this.formatCart(newCart);

    const otherLang = lang === 'en' ? 'ar' : 'en';
    await this.redisService.deleteKey(this.getCartKey(userId, otherLang));

    await this.cacheCart(userId, formattedCart, lang);

    return Promise.resolve();
  }

  async getCart(userId: number, lang: 'en' | 'ar' = 'en') {
    const cacheKey = this.getCartKey(userId, lang);
    const redisCart = await this.redisService.getValue(cacheKey);

    if (redisCart) return JSON.parse(redisCart);

    const cart = await this.prismaService.cart.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        items: {
          select: {
            product: {
              select: {
                id: true,
                translations: {
                  where: { languageCode: lang },
                  select: {
                    name: true,
                  },
                },
                price: true,
                offerPrice: true,
                mainImage: true,
              },
            },
            quantity: true,
          },
        },
      },
    });

    if (!cart) return { items: [] };

    const formattedCart = this.formatCart(cart);

    await this.cacheCart(userId, formattedCart, lang);

    return formattedCart;
  }
}
