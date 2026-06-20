// apps/admin-api/src/core/audit/admin-audit.interceptor.ts · coarse ACCESS trail for the god-mode plane.
// Every admin request (read or write) is recorded as an access event (actor, method+route, ip, request_id) via
// the standalone audit log — defence in depth on top of the in-transaction business audit each mutating service
// writes. Never logs bodies/secrets. Failures to audit must not break the request (best-effort access log), but
// the authoritative state-change audit is the in-tx one, which DOES block its transaction.
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AdminAuditWriter } from './admin-audit.writer';
import { AdminRequestContext } from '../auth/admin-auth.guard';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AdminAuditWriter) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const admin: AdminRequestContext | undefined = req.admin;
    return next.handle().pipe(tap({
      next: () => this.record(admin, req, 'ok'),
      error: () => this.record(admin, req, 'error'),
    }));
  }
  private record(admin: AdminRequestContext | undefined, req: any, outcome: string): void {
    if (!admin) return;
    void this.audit.log({
      actorUserId: admin.userId, actorRole: admin.roles[0] ?? null,
      action: `admin.access.${outcome}`, entityType: 'http', entityId: null,
      newValue: { method: req.method, route: req.route?.path ?? req.url },
      ip: admin.ip, requestId: admin.requestId || null,
    }).catch(() => undefined);   // access log is best-effort; the in-tx business audit is authoritative
  }
}
