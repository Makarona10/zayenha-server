import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Processor('payment-expiry')
export class PaymentExpiryProcessor extends WorkerHost {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async process(job: Job<{ orderId: number }>): Promise<void> {
    const { orderId } = job.data;

    await this.prismaService.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order || order.status !== OrderStatus.pending_payment) {
        return;
      }

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

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.canceled },
      });
    });
  }
}
