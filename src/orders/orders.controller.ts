import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FastifyRequest } from 'fastify';
import { CreateOrderDto } from './dto/create-order.dto';
import { resObj } from 'src/utils';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { CancellationStatus, OrderStatus } from '@prisma/client';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getOrderHistory(
    @Req() req: FastifyRequest,
    @Query('cursor') cursor?: string,
    @Query('sort') sort: 'desc' | 'asc' = 'desc',
  ) {
    const userId = req.user.id;
    const limit = 12;

    const orders = await this.ordersService.getOrderHistory(
      userId,
      limit,
      sort,
      cursor ? Number(cursor) : undefined,
    );

    return resObj(200, 'Order history fetched successfully', orders);
  }

  @Get('get-order/:id')
  @UseGuards(JwtAuthGuard)
  async getOrder(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest,
    @Query('lang') lang: 'en' | 'ar' = 'en',
  ) {
    const userId = req.user.id;
    const order = await this.ordersService.getOrderById(id, userId, lang);
    return resObj(200, 'Order fetched successfully', order);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(
    @Req() req: FastifyRequest,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    const userId = req.user.id;

    const order = await this.ordersService.createOrder(
      userId,
      createOrderDto.address,
      createOrderDto.paymentMethod,
    );

    const data = {
      orderId: order.id,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentUrl: order.paymentMethod === 'online' ? `/pay/${order.id}` : null,
    };

    return resObj(201, 'Order created successfully', data);
  }

  @Patch('cancel/:id')
  @UseGuards(JwtAuthGuard)
  async cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest,
    @Body() reason: string,
  ) {
    const userId = req.user.id;
    await this.ordersService.cancelOrder(id, userId, reason);

    return resObj(200, 'Order canceled successfully');
  }

  @Post('request-cancel/:id')
  @UseGuards(JwtAuthGuard)
  async requestCancellation(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest,
    @Body() reason: string,
  ) {
    const userId = req.user.id;
    await this.ordersService.createCancellationRequest(id, userId, reason);

    return resObj(201, 'Cancellation request submitted successfully');
  }

  @Patch('admin/cancellation-approval/:requestId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async handleCancellation(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() decision: CancellationStatus,
    @Body() adminNotes: string,
    @Req() req: FastifyRequest,
  ) {
    const adminId = req.user.id;
    await this.ordersService.processCancellationRequest(
      requestId,
      adminId,
      decision,
      adminNotes,
    );

    return resObj(200, 'Cancellation request processed successfully');
  }

  @Patch('status/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() status: OrderStatus,
  ) {
    await this.ordersService.updateOrderStatus(id, status);

    return resObj(200, 'Order status updated successfully');
  }
}
