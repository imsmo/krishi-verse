// core/http/request-id.middleware.ts
// Assigns a stable request id to every request (honouring an inbound
// X-Request-Id from the gateway/load-balancer for distributed tracing, else
// minting one). Read downstream by the tenant-context middleware, the logger,
// metrics, and the exception filter so a single id threads the whole request.
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, res: Response, next: NextFunction): void {
    const incoming = (req.headers['x-request-id'] as string | undefined)?.slice(0, 80);
    const id = incoming && incoming.length > 0 ? incoming : randomUUID();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  }
}
