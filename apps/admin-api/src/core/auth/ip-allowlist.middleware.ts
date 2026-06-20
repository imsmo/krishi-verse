// apps/admin-api/src/core/auth/ip-allowlist.middleware.ts · the god-mode plane is IP-restricted. Requests from
// an IP not on ADMIN_IP_ALLOWLIST are rejected BEFORE auth (defence in depth). Fail-closed: in production the
// allowlist must be set (enforced at boot in AdminConfig); if empty in non-prod, allow-all (dev convenience).
// Matches exact IPs or dotted prefixes (e.g. '10.0.' matches '10.0.x.y').
import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AdminConfig } from '../config/admin-config';

@Injectable()
export class IpAllowlistMiddleware implements NestMiddleware {
  constructor(private readonly config: AdminConfig) {}
  use(req: Request, _res: Response, next: NextFunction) {
    const allow = this.config.env.ADMIN_IP_ALLOWLIST;
    if (allow.length === 0) { if (this.config.isProd) throw new ForbiddenException('admin IP allowlist not configured'); return next(); }
    const ip = (req.ip ?? req.socket?.remoteAddress ?? '').replace(/^::ffff:/, '');
    const ok = allow.some((entry) => ip === entry || (entry.endsWith('.') && ip.startsWith(entry)));
    if (!ok) throw new ForbiddenException('source IP not allowed');
    next();
  }
}
