import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Payload } from './interfaces/payload.interface';

@Injectable()
export class MerchantApprovedGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user = request.user as Payload;
    if (!['merchant', 'admin'].includes(user.role)) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
