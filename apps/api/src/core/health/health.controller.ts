// core/health/health.controller.ts
// Liveness + readiness probes for Kubernetes. Liveness is cheap (process up).
// Readiness verifies the shard-0 writer pool answers `SELECT 1` so a pod that
// has lost its database is pulled out of rotation instead of serving 500s.
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PgPoolProvider } from '../database/pg-pool.provider';

@Controller()
export class HealthController {
  constructor(private readonly pools: PgPoolProvider) {}

  @Public() @Get('healthz')
  liveness() { return { data: { status: 'ok' } }; }

  @Public() @Get('readyz')
  async readiness() {
    try {
      await this.pools.writer(0).query('SELECT 1');
      return { data: { status: 'ready', db: 'up' } };
    } catch {
      return { data: { status: 'degraded', db: 'down' } };
    }
  }
}
