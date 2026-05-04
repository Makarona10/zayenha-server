import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MerchantAuthGuard implements CanActivate {
  constructor(private prismaService: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const body = request.body;

    const { email, password } = body || {};

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const merchant = await this.prismaService.merchant.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!merchant) {
      throw new NotFoundException('Invalid credentials');
    }

    request.merchant = { id: merchant.id, email: merchant.email };

    return true;
  }
}
