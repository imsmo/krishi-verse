// core/observability/metrics.controller.ts
// Prometheus scrape endpoint. Exposes the in-process counters/latency summaries.
import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PromMetrics } from './metrics.prom';

@Controller()
export class MetricsController {
  constructor(private readonly metrics: PromMetrics) {}
  @Public() @Get('metrics') @Header('Content-Type', 'text/plain; version=0.0.4')
  scrape(): string { return this.metrics.render(); }
}
