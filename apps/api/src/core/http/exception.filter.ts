// core/http/exception.filter.ts
// THE single place an error becomes an HTTP response. Maps:
//   • AppError (and all domain errors)  → its code + httpStatus + details
//   • ZodError                          → 422 VALIDATION_FAILED + field issues
//   • Nest HttpException                → its status, code from the name
//   • anything else                     → 500 INTERNAL (details hidden in prod)
// Always emits the standard error envelope with the request id, and logs 5xx.
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/app-error';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('ExceptionFilter');

  catch(err: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { requestId?: string }>();
    const requestId = req?.requestId ?? '';

    if (err instanceof AppError) {
      if (err.httpStatus >= 500) this.log.error(`${err.code}: ${err.message}`, (err as Error).stack);
      res.status(err.httpStatus).json(err.toEnvelope(requestId));
      return;
    }
    if (err instanceof ZodError) {
      res.status(422).json({
        error: { code: 'VALIDATION_FAILED', message: 'Request validation failed', details: err.flatten() },
        meta: { request_id: requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const resp = err.getResponse();
      res.status(status).json({
        error: { code: err.name.replace(/Exception$/, '').toUpperCase() || 'HTTP_ERROR',
                 message: typeof resp === 'string' ? resp : (resp as any)?.message ?? err.message, details: {} },
        meta: { request_id: requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    this.log.error('Unhandled error', (err as Error)?.stack ?? String(err));
    res.status(500).json({
      error: { code: 'INTERNAL', message: 'An unexpected error occurred', details: {} },
      meta: { request_id: requestId, timestamp: new Date().toISOString() },
    });
  }
}
