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

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const correlationId = correlationStorage.getStore() || 'system';

    const rawResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: exception.message || 'Internal server error' };

    const errorBody: any =
      typeof rawResponse === 'object'
        ? rawResponse
        : { message: rawResponse };

    const errorResponse = {
      success: false,
      error: {
        statusCode: status,
        message: errorBody.message || 'Internal server error',
        details: errorBody.error || errorBody.message || errorBody,
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
