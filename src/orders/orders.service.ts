import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CancellationStatus, OrderStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prismaService: PrismaService,
    @InjectQueue('payment-expiry') private readonly paymentQueue: Queue,
  ) {}

  async getOrderHistory(
    userId: number,
    limit: number,
    sort: 'asc' | 'desc' = 'desc',
    cursor?: number,
  ) {
    const orders = await this.prismaService.order.findMany({
      where: { userId },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: {
        createdAt: sort,
      },
      select: {
        id: true,
        totalAmount: true,
        createdAt: true,
        status: true,
        address: true,
      },
    });

    const nextCursor =
      orders.length === limit ? orders[orders.length - 1].id : null;

    return {
      orders,
      nextCursor,
    };
  }

  async getOrderById(orderId: number, userId: number, lang: string) {
    const order = await this.prismaService.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        address: true,
        paymentMethod: true,
        userId: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                mainImage: true,
                price: true,
                offerPrice: true,
                translations: {
                  where: { languageCode: lang },
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    return {
      orderId: order.id,
      status: order.status,
      address: order.address,
      paymentMethod: order.paymentMethod,
      products: order.items.map((item) => ({
        name: item.product.translations[0]?.name || 'Unknown Product',
        quantity: item.quantity,
        price: item.product.price,
        offerPrice: item.product.offerPrice,
        purchasedAtPrice: item.unitPrice,
        mainImage: item.product.mainImage,
      })),
    };
  }

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
            select: {
              productId: true,
              quantity: true,
              product: {
                select: {
                  stockQuantity: true,
                  id: true,
                  price: true,
                  offerPrice: true,
                },
              },
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
            `Insufficient stock for product: ${item.product.id}. Available: ${item.product.stockQuantity}`,
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

  async cancelOrder(orderId: number, userId: number, reason?: string) {
    const order = await this.prismaService.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status === OrderStatus.delivered ||
      order.status === OrderStatus.canceled
    ) {
      throw new BadRequestException(
        `Cannot cancel an order that is already ${order.status}`,
      );
    }

    const now = new Date();
    const orderDate = new Date(order.createdAt);
    const diffInHours =
      (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours > 48) {
      throw new ForbiddenException(
        'Cancellation window closed (48 hours exceeded). Please contact customer support at +123456789.',
      );
    }

    return await this.prismaService.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              increment: item.quantity,
            },
          },
        });
      }

      const canceledOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.canceled },
      });

      await tx.cancellationRequest.create({
        data: {
          orderId: orderId,
          userId: userId,
          reason: reason || 'User canceled within 48h window',
          status: 'approved',
        },
      });

      return canceledOrder;
    });
  }

  async createCancellationRequest(
    orderId: number,
    userId: number,
    reason: string,
  ) {
    const order = await this.prismaService.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        status: true,
        createdAt: true,
        cancellation: { select: { id: true } },
      },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    if (order.cancellation) {
      throw new BadRequestException(
        'A cancellation request has already been submitted for this order',
      );
    }

    const forbiddenStatuses: any[] = [
      OrderStatus.delivered,
      OrderStatus.canceled,
      OrderStatus.refunded,
    ];
    if (forbiddenStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot request cancellation for an order that is ${order.status}`,
      );
    }

    const now = new Date();
    const diffInHours =
      (now.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60);

    if (diffInHours <= 48) {
      throw new BadRequestException(
        'Order is still within the 48h auto-cancel window.',
      );
    }

    return await this.prismaService.cancellationRequest.create({
      data: {
        orderId: orderId,
        userId: userId,
        reason: reason,
        status: 'pending',
      },
    });
  }

  async processCancellationRequest(
    requestId: number,
    adminId: number,
    decision: CancellationStatus,
    adminNotes?: string,
  ) {
    const request = await this.prismaService.cancellationRequest.findUnique({
      where: { id: requestId },
      include: {
        order: {
          include: { items: true },
        },
      },
    });

    if (!request) throw new BadRequestException('Request not found');
    if (request.status !== 'pending') {
      throw new BadRequestException(
        `Request has already been ${request.status}`,
      );
    }

    return await this.prismaService.$transaction(async (tx) => {
      if (decision === 'approved') {
        for (const item of request.order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }

        await tx.order.update({
          where: { id: request.orderId },
          data: { status: 'canceled' },
        });
      }

      return await tx.cancellationRequest.update({
        where: { id: requestId },
        data: {
          status: decision === 'approved' ? 'approved' : 'rejected',
          adminNotes: adminNotes,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      });
    });
  }

  async updateOrderStatus(orderId: number, newStatus: OrderStatus) {
    const order = await this.prismaService.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (
      order.status === OrderStatus.canceled ||
      order.status === OrderStatus.delivered
    ) {
      throw new BadRequestException(
        `Cannot change status of an order that is already ${order.status}`,
      );
    }

    if (newStatus === OrderStatus.canceled) {
      return await this.prismaService.$transaction(async (tx) => {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }

        return await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.canceled },
        });
      });
    }

    return await this.prismaService.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });
  }
}
