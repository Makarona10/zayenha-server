import {
  BadRequestException,
  Injectable,
  NestMiddleware,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MerchantIdMiddleware implements NestMiddleware {
  constructor(private readonly prismaService: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const credentials = req?.body;
    const email = credentials.email;
    const password = credentials.password;

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    if (!password) {
      throw new BadRequestException('Password is required');
    }

    const merchant = await this.prismaService.merchant.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!merchant) {
      throw new NotFoundException('Invalid credentials');
    }

    (req as any).merchant = { id: merchant.id, email: merchant.email };

    next();
  }
}
