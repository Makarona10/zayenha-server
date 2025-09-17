import { HttpException, HttpStatus } from '@nestjs/common';

export class CustomBusinessException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ statusCode: status, message }, status);
  }
}
