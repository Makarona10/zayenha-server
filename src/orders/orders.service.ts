import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OrderStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prismaService: PrismaService,
    @InjectQueue('payment-expiry') private readonly paymentQueue: Queue,
  ) {}

  async createOrder(
    userId: number,
    address: string,
    paymentMethod: 'online' | 'cod',
  ) {
    const order = await this.prismaService.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        select: {
          id: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Your cart is empty');
      }

      for (const item of cart.items) {
        if (item.product.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product: ${item.product.sku}. Available: ${item.product.stockQuantity}`,
          );
        }

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      const totalAmount = cart.items.reduce((sum, item) => {
        const activePrice = item.product.offerPrice ?? item.product.price;
        return sum + Number(activePrice) * item.quantity;
      }, 0);

      const newOrder = await tx.order.create({
        data: {
          userId,
          address,
          totalAmount,
          paymentMethod: paymentMethod as PaymentMethod,
          status:
            paymentMethod === 'online'
              ? OrderStatus.pending_payment
              : OrderStatus.confirmed,
          paymentExpiresAt:
            paymentMethod === 'online'
              ? new Date(Date.now() + 10 * 60 * 1000)
              : null,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.product.offerPrice ?? item.product.price,
            })),
          },
        },
      });

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return newOrder;
    });

    if (paymentMethod === 'online') {
      await this.paymentQueue.add(
        'payment-expiry',
        { orderId: order.id },
        {
          delay: 10 * 60 * 1000,
          jobId: `expire-order-${order.id}`,
          removeOnComplete: true,
        },
      );
    }

    return order;
  }
}
