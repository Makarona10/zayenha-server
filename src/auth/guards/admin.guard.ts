import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if user exists and has the admin role
    // Adjust 'admin' to match whatever string/enum you use in your DB
    if (user && user.role === 'admin') {
      return true;
    }

    throw new ForbiddenException('Access denied: Admins only');
  }
}
