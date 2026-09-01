import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { correlationStorage } from '../logger/correlation.context';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Map Prisma P2002 (Unique constraint violation) to HTTP 409 Conflict
    if (exception?.code === 'P2002') {
      status = HttpStatus.CONFLICT;
    }

    const correlationId = correlationStorage.getStore() || 'system';

    const rawResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception?.code === 'P2002'
          ? { message: `Unique constraint conflict on field: ${exception.meta?.target || 'resource'}` }
          : { message: exception.message || 'Internal server error' };

    const errorBody: any =
      typeof rawResponse === 'object' ? rawResponse : { message: rawResponse };

    const errorResponse = {
      success: false,
      error: {
        statusCode: status,
        message:
          status >= 500
            ? 'Internal server error'
            : errorBody.message || 'Internal server error',
        details:
          status >= 500 ? undefined : errorBody.error || errorBody.message,
      },
      meta: {
        requestId: correlationId,
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    };

    this.logger.error(
      `Request failed at ${request.method} ${request.url} with status ${status}: ${exception.message || JSON.stringify(rawResponse)}`,
      exception.stack,
    );

    response.status(status).json(errorResponse);
  }
}
