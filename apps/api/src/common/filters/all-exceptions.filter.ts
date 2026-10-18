import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Beklenmeyen bir hata oluştu.';
    let code = 'INTERNAL_ERROR';
    let error = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const record = body as Record<string, unknown>;
        if (typeof record.code === 'string') code = record.code;
        if (typeof record.message === 'string' || Array.isArray(record.message)) {
          message = record.message as string | string[];
        }
        if (typeof record.error === 'string') error = record.error;
      }
      if (code === 'INTERNAL_ERROR') {
        if (status === 400) code = 'VALIDATION_ERROR';
        else if (status === 401) code = 'UNAUTHORIZED';
        else if (status === 403) code = 'FORBIDDEN';
        else if (status === 404) code = 'NOT_FOUND';
        else if (status === 409) code = 'CONFLICT';
        else if (status === 429) code = 'RATE_LIMITED';
      }
      if (status === 429) {
        message = 'Çok fazla istek gönderildi. Bir süre sonra yeniden deneyin.';
      }
      if (status >= 500) {
        this.logger.error(exception instanceof Error ? exception.stack : String(exception));
        reportSentry(exception);
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      reportSentry(exception);
    }

    response.status(status).json({
      statusCode: status,
      error,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}

function reportSentry(exception: unknown): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  const message = exception instanceof Error ? exception.stack ?? exception.message : String(exception);
  // DSN yoksa no-op. Doluysa yığın istemciye gitmez; yalnızca süreç günlüğüne düşer.
  new Logger('Sentry').error(message);
}
