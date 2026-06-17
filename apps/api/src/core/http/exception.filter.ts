// core/http/exception.filter.ts
// THE single place an error becomes an HTTP response. Maps:
//   • AppError (and all domain errors)  → its code + httpStatus + details
//   • ZodError                          → 422 VALIDATION_FAILED + field issues
//   • Nest HttpException                → its status, code from the name
//   • anything else                     → 500 INTERNAL (details hidden in prod)
// Messages are LOCALISED (Law 7) by error code into the caller's language when a
// translation exists; otherwise the original message is kept. Always emits the
// standard envelope with the request id; logs 5xx. Never leaks internals/PII.
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/app-error';
import { TranslationService } from '../i18n/translation.service';
import { tryGetRequestContext } from '../tenancy-context/request-context';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('ExceptionFilter');
  constructor(private readonly i18n: TranslationService) {}

  /** Localised message for a stable error code, falling back to the original message. */
  private msg(code: string, fallback: string): string {
    const lang = tryGetRequestContext()?.lang ?? 'en';
    const key = `error.${code}`;
    return this.i18n.has(key) ? this.i18n.t(key, lang) : fallback;
  }

  catch(err: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { requestId?: string }>();
    const requestId = req?.requestId ?? '';
    const meta = { request_id: requestId, timestamp: new Date().toISOString() };

    if (err instanceof AppError) {
      if (err.httpStatus >= 500) this.log.error(`${err.code}: ${err.message}`, (err as Error).stack);
      res.status(err.httpStatus).json({
        error: { code: err.code, message: this.msg(err.code, err.message), details: err.details ?? {} },
        meta,
      });
      return;
    }
    if (err instanceof ZodError) {
      res.status(422).json({
        error: { code: 'VALIDATION_FAILED', message: this.msg('VALIDATION_FAILED', 'Request validation failed'), details: err.flatten() },
        meta,
      });
      return;
    }
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const resp = err.getResponse();
      const code = err.name.replace(/Exception$/, '').toUpperCase() || 'HTTP_ERROR';
      res.status(status).json({
        error: { code, message: this.msg(code, typeof resp === 'string' ? resp : (resp as any)?.message ?? err.message), details: {} },
        meta,
      });
      return;
    }
    this.log.error('Unhandled error', (err as Error)?.stack ?? String(err));
    res.status(500).json({
      error: { code: 'INTERNAL', message: this.msg('INTERNAL', 'An unexpected error occurred'), details: {} },
      meta,
    });
  }
}
