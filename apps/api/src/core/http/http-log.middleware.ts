// core/http/http-log.middleware.ts — dev-friendly HTTP access log (S6-prep debugging aid).
//
// WHY: the exception filter only wrote terminal logs for 5xx, so a 403/404 (feature flag off,
// permission denied, missing row) produced a "Something went wrong" on the phone and NOTHING
// in the api terminal — undebuggable for a founder testing on a device. This middleware prints
// one line per request:   ← POST /v1/onboarding/roles 404 12ms [req_abc123]
//
// Enabled when NODE_ENV !== 'production', or explicitly via LOG_HTTP=true (safe to enable in
// staging; keep OFF in production — access logs at scale belong to the ALB/ingress layer).
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class HttpLogMiddleware implements NestMiddleware {
  private readonly log = new Logger('HTTP');
  private readonly enabled =
    process.env.NODE_ENV !== 'production' || process.env.LOG_HTTP === 'true';

  use(req: Request & { requestId?: string }, res: Response, next: NextFunction): void {
    if (!this.enabled) return next();
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const rid = req.requestId ? ` [${req.requestId}]` : '';
      const line = `← ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms${rid}`;
      if (res.statusCode >= 500) this.log.error(line);
      else if (res.statusCode >= 400) this.log.warn(line);
      else this.log.log(line);
    });
    next();
  }
}
