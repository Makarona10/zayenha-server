import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply | any>();
    const request = ctx.getRequest<FastifyRequest>();

    let status: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        error = responseObj.error || exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaError(exception);
      status = prismaError.status;
      message = prismaError.message;
      error = 'DatabaseError';
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      error = 'ValidationError';

      this.logger.error('Prisma Validation Error:', exception.message);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'InternalServerError';

      this.logger.error('Unhandled Exception:', exception);
    }

    const errorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${status}`,
        JSON.stringify(errorResponse),
      );
    } else if (status >= 400 && status < 500) {
      this.logger.warn(
        `[${request.method}] ${request.url} - ${status}: ${message}`,
      );
    }

    if (typeof response.code === 'function') {
      return response.code(status).send(errorResponse);
    }

    if (typeof response.status === 'function') {
      return response.status(status).send(errorResponse);
    }

    const rawResponse = response.raw || response;
    rawResponse.statusCode = status;
    rawResponse.setHeader('Content-Type', 'application/json');
    return rawResponse.end(JSON.stringify(errorResponse));
  }

  private handlePrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
  } {
    switch (exception.code) {
      case 'P2002': {
        const field =
          (exception.meta?.target as string[])?.join(', ') || 'field';
        return {
          status: HttpStatus.CONFLICT,
          message: `${field} already exists`,
        };
      }

      case 'P2025': {
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
        };
      }

      case 'P2003': {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid reference to related record',
        };
      }

      case 'P2018': {
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record to delete does not exist',
        };
      }

      case 'P2006': {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid value provided',
        };
      }

      case 'P1001':
      case 'P1002':
      case 'P1008': {
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Database connection error',
        };
      }

      default: {
        this.logger.error(
          `Unhandled Prisma Error Code: ${exception.code}`,
          exception,
        );
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error occurred',
        };
      }
    }
  }
}
