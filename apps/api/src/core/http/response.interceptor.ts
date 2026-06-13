// core/http/response.interceptor.ts
// Guarantees a consistent success envelope: every 2xx body is
// { data, meta:{ request_id, timestamp } }. Controllers return { data, meta? }
// (or a raw value); this fills in meta and never leaks internal shapes.
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { requestId?: string }>();
    const requestId = req?.requestId ?? '';
    return next.handle().pipe(map((body: any) => {
      const meta = { request_id: requestId, timestamp: new Date().toISOString() };
      if (body && typeof body === 'object' && 'data' in body) {
        return { ...body, meta: { ...meta, ...(body.meta ?? {}) } };
      }
      return { data: body ?? null, meta };
    }));
  }
}
