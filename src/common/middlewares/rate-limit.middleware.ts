import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

@Injectable()
export class RefreshTokenRateLimitMiddleware implements NestMiddleware {
  private limiter = rateLimit({
    windowMs: 30 * 1000,
    max: 1,
    message: 'Too many refresh attempts, please wait before trying again.',
    keyGenerator: (req: Request) => req.cookies['refreshToken'] || req.ip,
  });

  use(req: Request, res: Response, next: NextFunction) {
    this.limiter(req, res, next);
  }
}
